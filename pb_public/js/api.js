(function (global) {
    'use strict';

    function readJsonScript(id, fallback) {
        if (typeof document === 'undefined') return fallback;
        const el = document.getElementById(id);
        if (!el) return fallback;
        try {
            return JSON.parse(el.textContent || 'null') || fallback;
        } catch (err) {
            console.error(`Failed to parse #${id}:`, err);
            return fallback;
        }
    }

    function isDesktop() {
        return typeof window !== 'undefined' && window.innerWidth >= 1024;
    }

    function safeDecodePath(val) {
        if (typeof val !== 'string') return '';
        try {
            return decodeURIComponent(val);
        } catch (_) {
            return val;
        }
    }

    function preloadImage(url, timeoutMs) {
        if (!url || typeof Image === 'undefined') return Promise.resolve();
        return new Promise((resolve) => {
            let settled = false;
            const done = () => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            };
            const timer = setTimeout(done, timeoutMs || 180);
            try {
                const img = new Image();
                const finishDecode = () => {
                    clearTimeout(timer);
                    if (typeof img.decode === 'function') {
                        img.decode().then(done, done);
                    } else {
                        done();
                    }
                };
                img.onload = finishDecode;
                img.onerror = () => {
                    clearTimeout(timer);
                    done();
                };
                img.src = url;
                if (img.complete) finishDecode();
            } catch (_) {
                clearTimeout(timer);
                done();
            }
        });
    }

    function setBoundedCache(cache, key, value, maxSize) {
        if (!key) return;
        if (cache.has(key)) cache.delete(key);
        cache.set(key, value);
        while (cache.size > maxSize) {
            const oldestKey = cache.keys().next().value;
            cache.delete(oldestKey);
        }
    }

    function getListCacheKey(section, query) {
        const params = new URLSearchParams();
        params.set('section', section);
        if (query && query.page) params.set('page', String(query.page));
        if (query && query.query) params.set('query', String(query.query));
        if (query && query.climbType) params.set('climbType', String(query.climbType));
        return params.toString();
    }

    function createListSnapshot(section, data) {
        return {
            data,
            extraPosts: [],
            infinitePage: data.currentPage || 1,
            hasMore: section === 'home' && (data.currentPage || 1) < (data.totalPages || 1),
        };
    }

    function createBlogClient(initialPayload, fetchImpl) {
        const fetchFn = fetchImpl || (typeof fetch === 'function' ? fetch.bind(global) : null);
        const listCache = new Map();
        const postCache = new Map();
        let currentInitial = initialPayload || null;
        let resolvedRoutePayload = null;

        function consumeInitialPayload(expectedType, matcher) {
            if (!currentInitial || currentInitial.type !== expectedType) return null;
            if (matcher && !matcher(currentInitial)) return null;
            const consumed = currentInitial;
            currentInitial = null;
            return consumed;
        }

        function seedCacheFromInitial(routeLocation) {
            if (!currentInitial || !routeLocation) return;
            if (currentInitial.type === 'posts-list') {
                const section = currentInitial.isHomepage
                    ? 'home'
                    : (currentInitial.isClimbing ? 'climbing' : 'blog');
                const key = getListCacheKey(section, routeLocation.query);
                if (!listCache.has(key)) {
                    setBoundedCache(listCache, key, createListSnapshot(section, currentInitial), 25);
                }
            } else if (currentInitial.type === 'post-detail' && currentInitial.post && currentInitial.post.id) {
                const climbingFlag = !!currentInitial.post.isClimbing;
                const entry = { ok: true, found: true, data: currentInitial };
                setBoundedCache(postCache, `post:${climbingFlag}:id:${currentInitial.post.id}`, entry, 50);
            }
        }

        function consumeResolvedPayload(fullPath, expectedType) {
            if (!resolvedRoutePayload || resolvedRoutePayload.fullPath !== fullPath) return null;
            if (expectedType && resolvedRoutePayload.type !== expectedType) return null;
            const consumed = resolvedRoutePayload;
            resolvedRoutePayload = null;
            return consumed;
        }

        async function fetchPostsPayload(section, query, signal) {
            const key = getListCacheKey(section, query);
            if (listCache.has(key)) {
                return listCache.get(key);
            }
            const res = await fetchFn(`/api/posts?${key}`, signal ? { signal } : undefined);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const entry = createListSnapshot(section, json);
            setBoundedCache(listCache, key, entry, 25);
            return entry;
        }

        async function fetchSinglePostPayload(isClimbing, params, signal) {
            const climbingFlag = !!isClimbing;
            const idKey = params && params.id ? `post:${climbingFlag}:id:${String(params.id)}` : null;
            const titleKey = params && params.title ? `post:${climbingFlag}:title:${String(params.title)}` : null;
            const cached = (idKey && postCache.get(idKey)) || (!idKey && titleKey && postCache.get(titleKey));
            if (cached) return cached;

            const queryParams = new URLSearchParams();
            queryParams.set('type', climbingFlag ? 'climbing' : 'blog');
            if (params && params.title) queryParams.set('title', String(params.title));
            if (params && params.id) queryParams.set('id', String(params.id));

            const res = await fetchFn(`/api/post?${queryParams.toString()}`, signal ? { signal } : undefined);
            const json = await res.json();
            const entry = {
                ok: res.ok,
                found: !!(res.ok && json && json.found),
                data: json,
            };
            if (entry.found && json.post && json.post.id) {
                setBoundedCache(postCache, `post:${climbingFlag}:id:${json.post.id}`, entry, 50);
                if (!idKey && titleKey) {
                    setBoundedCache(postCache, titleKey, entry, 50);
                }
            }
            return entry;
        }

        async function prefetchTargetRoute(to, from, signal) {
            resolvedRoutePayload = null;

            if (to.name === 'home' || to.name === 'blog-list' || to.name === 'climbing-list') {
                const section = to.name === 'home' ? 'home' : (to.name === 'climbing-list' ? 'climbing' : 'blog');
                const entry = await fetchPostsPayload(section, to.query, signal);
                if (signal && signal.aborted) return null;

                resolvedRoutePayload = {
                    fullPath: to.fullPath,
                    type: 'posts-list',
                    entry,
                };

                const fromId = from && from.params && from.params.id ? String(from.params.id) : null;
                const d = entry.data || {};
                const candidates = [d.heroPost, ...(d.gridPosts || []), ...(entry.extraPosts || [])].filter(Boolean);
                const matchingCard = fromId ? candidates.find((c) => c.id === fromId) : null;
                const imgUrl = matchingCard
                    ? (matchingCard === d.heroPost ? matchingCard.heroImageUrl : matchingCard.gridImageUrl)
                    : (d.heroPost?.heroImageUrl || d.gridPosts?.[0]?.gridImageUrl);
                if (imgUrl) {
                    await preloadImage(imgUrl, 160);
                }
                return null;
            }

            if (
                to.name === 'blog-detail' ||
                to.name === 'blog-legacy' ||
                to.name === 'climbing-detail' ||
                to.name === 'climbing-legacy'
            ) {
                const isClimbing = to.name.startsWith('climbing');
                const entry = await fetchSinglePostPayload(isClimbing, to.params, signal);
                if (signal && signal.aborted) return null;

                if (
                    entry.found &&
                    entry.data &&
                    entry.data.canonicalPath &&
                    safeDecodePath(to.path) !== safeDecodePath(entry.data.canonicalPath)
                ) {
                    return entry.data.canonicalPath;
                }

                resolvedRoutePayload = {
                    fullPath: to.fullPath,
                    type: 'post-detail',
                    entry,
                };

                if (entry.found && entry.data && entry.data.post && entry.data.post.imageUrl) {
                    await preloadImage(entry.data.post.imageUrl, 200);
                }
                return null;
            }

            return null;
        }

        return {
            listCache,
            postCache,
            consumeInitialPayload,
            seedCacheFromInitial,
            consumeResolvedPayload,
            fetchPostsPayload,
            fetchSinglePostPayload,
            prefetchTargetRoute,
        };
    }

    global.BlogApi = {
        readJsonScript,
        isDesktop,
        safeDecodePath,
        preloadImage,
        setBoundedCache,
        getListCacheKey,
        createListSnapshot,
        createBlogClient,
    };
})(typeof window !== 'undefined' ? window : globalThis);
