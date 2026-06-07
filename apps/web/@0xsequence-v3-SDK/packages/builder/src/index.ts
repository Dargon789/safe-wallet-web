export * from './builder.gen'

import { Builder as BuilderRpc } from './builder.gen'

export class SequenceBuilderClient extends BuilderRpc {
  constructor(
    public projectAccessKey: string,
    apiUrl?: string
  ) {
    const hostname = apiUrl ?? 'https://api.sequence.build'
    super(hostname.endsWith('/') ? hostname.slice(0, -1) : hostname, fetch)
    this.fetch = this._fetch
  }

  _fetch = (input: RequestInfo, init?: RequestInit): Promise<Response> => {
    const reqInit = init || {}
    const reqHeaders = reqInit.headers instanceof Headers
      ? Object.fromEntries(reqInit.headers.entries())
      : { ...reqInit.headers }

    const projectAccessKey = this.projectAccessKey
    if (projectAccessKey && projectAccessKey.length > 0) {
      reqHeaders['X-Access-Key'] = projectAccessKey
    }

    reqInit.headers = reqHeaders

    return fetch(input, reqInit)
  }
}
