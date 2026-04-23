import { isTokenExpiringSoon, refreshAccessToken } from '../api/auth';
import type { MessageMetadata, EmailHeader } from '../types/index';

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface ListMessagesResponse {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

interface GmailMessageResponse {
  id: string;
  threadId: string;
  labelIds?: string[];
  payload?: {
    headers?: EmailHeader[];
  };
}

export class GmailApiClient {
  private getAccessToken: () => Promise<string>;

  constructor(getAccessToken: () => Promise<string>) {
    this.getAccessToken = getAccessToken;
  }

  async listMessageIds(params?: {
    pageToken?: string;
    labelIds?: string[];
    query?: string;
  }): Promise<{
    messageIds: string[];
    nextPageToken?: string;
    resultSizeEstimate?: number;
  }> {
    const url = new URL(`${GMAIL_BASE}/messages`);
    url.searchParams.set('maxResults', '500');

    if (params?.pageToken) {
      url.searchParams.set('pageToken', params.pageToken);
    }
    if (params?.labelIds) {
      for (const label of params.labelIds) {
        url.searchParams.append('labelIds', label);
      }
    }
    if (params?.query) {
      url.searchParams.set('q', params.query);
    }

    const response = await this.fetchWithRetry(url.toString());
    const data = (await response.json()) as ListMessagesResponse;

    return {
      messageIds: (data.messages ?? []).map((m) => m.id),
      nextPageToken: data.nextPageToken,
      resultSizeEstimate: data.resultSizeEstimate,
    };
  }

  async batchGetMetadata(ids: string[]): Promise<MessageMetadata[]> {
    const results: MessageMetadata[] = [];
    // Process in small concurrent groups to avoid 429 rate limiting
    const CONCURRENCY = 5;
    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const chunk = ids.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(chunk.map((id) => this.fetchMessageMetadata(id)));
      results.push(...batch);
      // Small delay between groups to respect rate limits
      if (i + CONCURRENCY < ids.length) {
        await sleep(200);
      }
    }
    return results;
  }

  async trashMessages(ids: string[]): Promise<void> {
    const url = `${GMAIL_BASE}/messages/batchModify`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, addLabelIds: ['TRASH'] }),
    });
  }

  async createFilter(
    criteria: { from: string },
    action: { addLabelIds?: string[]; removeLabelIds?: string[] }
  ): Promise<void> {
    const url = `${GMAIL_BASE}/settings/filters`;
    await this.fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criteria, action }),
    });
  }

  private async fetchMessageMetadata(id: string): Promise<MessageMetadata> {
    const url = new URL(`${GMAIL_BASE}/messages/${id}`);
    url.searchParams.set('format', 'METADATA');
    url.searchParams.append('metadataHeaders', 'From');
    url.searchParams.append('metadataHeaders', 'Subject');
    url.searchParams.append('metadataHeaders', 'Date');
    url.searchParams.append('metadataHeaders', 'List-Unsubscribe');

    const response = await this.fetchWithRetry(url.toString());
    const data = (await response.json()) as GmailMessageResponse;

    const headers = data.payload?.headers ?? [];
    const getHeader = (name: string): string =>
      headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';

    return {
      id: data.id,
      threadId: data.threadId,
      from: getHeader('From'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      isUnread: (data.labelIds ?? []).includes('UNREAD'),
      listUnsubscribe: getHeader('List-Unsubscribe') || null,
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<Response> {
    // Proactively refresh token if expiring soon
    if (isTokenExpiringSoon()) {
      await refreshAccessToken();
    }

    const token = await this.getAccessToken();
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${token}`);

    const response = await fetch(url, { ...options, headers });

    if (response.ok) {
      return response;
    }

    const status = response.status;

    // 401: refresh token and retry once
    if (status === 401) {
      if (retryCount >= 1) {
        throw new Error(`Gmail API error 401: Unauthorized after token refresh`);
      }
      await refreshAccessToken();
      return this.fetchWithRetry(url, options, retryCount + 1);
    }

    // 429: exponential backoff — 2s, 4s, 8s (max 3 retries)
    if (status === 429) {
      if (retryCount >= 3) {
        throw new Error(`Gmail API error 429: Rate limit exceeded after ${retryCount} retries`);
      }
      await sleep(2 ** (retryCount + 1) * 1000);
      return this.fetchWithRetry(url, options, retryCount + 1);
    }

    // 5xx: fixed 2s delay, max 3 retries
    if (status >= 500) {
      if (retryCount >= 3) {
        throw new Error(`Gmail API error ${status}: Server error after ${retryCount} retries`);
      }
      await sleep(2000);
      return this.fetchWithRetry(url, options, retryCount + 1);
    }

    // Other 4xx: throw immediately
    throw new Error(`Gmail API error ${status}: ${response.statusText}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
