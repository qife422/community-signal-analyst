// Host-side helper for an already authorized cua_repl Tab; never connects to a browser itself.
export const POST_SELECTOR = '[id^="post_"][id$="_content"]';

// This function is serialized by the documented read-only locator.evaluateAll API.
export function readPostCards(elements, { maxRoots }) {
  return { rootCount: elements.length, cards: elements.slice(0, maxRoots).map(element => {
    const lines = element.innerText.split('\n').map(s => s.trim()).filter(Boolean);
    const separator = lines.indexOf('·');
    const body = Array.from(element.querySelectorAll('p')).map(p => p.innerText.trim()).filter(Boolean).join('\n');
    return {
      id: element.id.replace(/_content$/, ''), author: lines[0] || '',
      publishedLabel: separator >= 0 ? lines[separator + 1] || '' : '',
      pinned: lines.slice(0, 6).includes('置顶帖子'), body: body.slice(0, 4001),
      collapsed: Array.from(element.querySelectorAll('button')).some(b => b.innerText === '查看更多')
    };
  }) };
}

function scopeUrl(scope) {
  if (!scope || typeof scope.channelUrl !== 'string' || typeof scope.communityName !== 'string'
    || !scope.communityName.trim() || scope.communityName.length > 100
    || !/^exp_[A-Za-z0-9]{1,100}$/.test(scope.experienceId || '')) throw new Error('Invalid selected Whop scope');
  const url = new URL(scope.channelUrl);
  if (url.href !== scope.channelUrl || url.protocol !== 'https:' || url.hostname !== 'whop.com'
    || url.username || url.password || url.port || url.search || url.hash
    || !/^\/.+\/exp_[A-Za-z0-9]{1,100}\/app\/$/.test(url.pathname)
    || !url.pathname.endsWith('/' + scope.experienceId + '/app/')) throw new Error('Invalid selected Whop URL');
  return scope.channelUrl;
}

/** No navigation, clicks, typing, cookies, hidden state, network calls or disk writes. */
export async function captureWhopPage(tab, scope, { maxRoots = 12, channelName } = {}) {
  const url = scopeUrl(scope);
  if (!Number.isInteger(maxRoots) || maxRoots < 1 || maxRoots > 50
    || typeof channelName !== 'string' || !channelName.trim() || channelName.length > 100) throw new Error('Choose a visible channel name and1–50 roots');
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      if (await tab.url() !== url) return { status: 'unavailable', reason: 'source_mismatch', attempts, posts: [] };
      const raw = await tab.playwright.locator(POST_SELECTOR).evaluateAll(readPostCards, { maxRoots }, { timeoutMs: 15000 });
      attempts.push({ attempt, status: 'read', durationMs: Date.now() - started });
      if (!raw || !Number.isInteger(raw.rootCount) || !Array.isArray(raw.cards) || raw.cards.length > maxRoots) throw new Error('Invalid DOM capture result');
      // Zero cards may mean loading or changed layout. Never label it an empty/inactive community.
      if (raw.rootCount === 0) return { status: 'not_ready', reason: 'loading_or_layout_changed', attempts, posts: [] };
      const posts = [], excluded = [], ids = new Set();
      for (const card of raw.cards) {
        let reason;
        if (!/^post_[A-Za-z0-9]{1,100}$/.test(card.id || '') || ids.has(card.id)) reason = 'invalid_or_duplicate_id';
        else if (card.collapsed) reason = 'collapsed_body';
        else if (typeof card.author !== 'string' || !card.author.trim() || card.author.length > 100
          || typeof card.publishedLabel !== 'string' || !card.publishedLabel.trim() || card.publishedLabel.length > 100) reason = 'missing_or_invalid_metadata';
        else if (typeof card.body !== 'string' || !card.body.trim()) reason = 'no_text_body';
        else if (card.body.length > 4000) reason = 'body_over_limit';
        if (reason) { excluded.push({ id: card.id || null, reason }); continue; }
        ids.add(card.id);
        posts.push({ id: card.id, author: card.author, publishedLabel: card.publishedLabel, pinned: card.pinned === true, body: card.body });
      }
      if (!posts.length) return { status: 'no_usable_text', attempts, rootCount: raw.rootCount, excluded, posts: [] };
      return {
        status: 'ok', attempts,
        snapshot: { schemaVersion: 1, retrievalMethod: 'browser_visible', fetchedAt: new Date().toISOString(),
          sources: [{ url, experienceId: scope.experienceId, communityName: scope.communityName, channelName,
            access: { status: 'ok', note: 'Bounded rendered DOM text; completeness not established.' }, posts }],
          captureNotes: { method: 'direct_locator_evaluateAll', rootCount: raw.rootCount, inspectedRoots: raw.cards.length,
            maxRoots, excluded, channelInputActions: 0, channelMessagesSent: 0,
            absolutePublicationDatesInferred: false, completeHistory: false } }
      };
    } catch (error) {
      const transport = /CDP|command dispatch|deadline|Emulation\.setFocusEmulationEnabled|Page\.getFrameTree|Runtime\.evaluate|Timed out after.*command/i.test(String(error));
      attempts.push({ attempt, status: 'failed', category: transport ? 'browser_transport' : 'read_error', durationMs: Date.now() - started });
      if (!transport || attempt === 2) return { status: 'unavailable', reason: transport ? 'browser_transport' : 'read_error', attempts, posts: [] };
      // One sequential retry on the SAME handle/selected URL. No overlapping requests or reload loop.
    }
  }
}
