(function () {
    'use strict';

    function readJsonScript(id, fallback) {
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

    function trackPostClick(post) {
        if (!post || typeof window.gtag !== 'function') return;
        window.gtag('event', 'click', {
            event_category: post.itemIsClimbing ? 'climbing_log' : 'blog_post',
            event_label: post.title || '',
        });
    }

    function normalizeExtraItem(item) {
        return {
            id: item.id,
            title: item.title,
            slug: item.slug,
            link: item.link,
            previewText: item.text || item.previewText || '',
            heroImageUrl: item.imageUrl || item.heroImageUrl || null,
            gridImageUrl: item.imageUrl || item.gridImageUrl || null,
            formattedDate: item.date || item.formattedDate || '',
            itemIsClimbing: !!item.itemIsClimbing,
            badges: (item.badges || []).map((b) =>
                typeof b === 'string' ? { text: b, query: b } : b
            ),
            location: item.location || null,
        };
    }

    function initApp() {
        if (typeof Vue === 'undefined' || typeof VueRouter === 'undefined') return;
        const mountEl = document.getElementById('app');
        const initialScriptEl = document.getElementById('initial-route-data');
        if (!mountEl || !initialScriptEl) return;

        let initialPayload = readJsonScript('initial-route-data', null);
        const appConfig = readJsonScript('app-config-data', {
            siteName: 'The Justin Blog',
            currentYear: new Date().getFullYear(),
            navigation: [
                { title: 'Climbing', url: '/climbing' },
                { title: 'Development', url: '/blog/posts' },
            ],
            socials: [],
        });

        function consumeInitialPayload(expectedType, matcher) {
            if (!initialPayload || initialPayload.type !== expectedType) return null;
            if (matcher && !matcher(initialPayload)) return null;
            const consumed = initialPayload;
            initialPayload = null;
            return consumed;
        }

        const listCache = new Map();
        const postCache = new Map();
        let resolvedRoutePayload = null;

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

        async function fetchPostsPayload(section, query, signal) {
            const key = getListCacheKey(section, query);
            if (listCache.has(key)) {
                return listCache.get(key);
            }
            const res = await fetch(`/api/posts?${key}`, signal ? { signal } : undefined);
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

            const res = await fetch(`/api/post?${queryParams.toString()}`, signal ? { signal } : undefined);
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

        function seedCacheFromInitial(routeLocation) {
            if (!initialPayload || !routeLocation) return;
            if (initialPayload.type === 'posts-list') {
                const section = initialPayload.isHomepage
                    ? 'home'
                    : (initialPayload.isClimbing ? 'climbing' : 'blog');
                const key = getListCacheKey(section, routeLocation.query);
                if (!listCache.has(key)) {
                    setBoundedCache(listCache, key, createListSnapshot(section, initialPayload), 25);
                }
            } else if (initialPayload.type === 'post-detail' && initialPayload.post && initialPayload.post.id) {
                const climbingFlag = !!initialPayload.post.isClimbing;
                const entry = { ok: true, found: true, data: initialPayload };
                setBoundedCache(postCache, `post:${climbingFlag}:id:${initialPayload.post.id}`, entry, 50);
            }
        }

        function consumeResolvedPayload(fullPath, expectedType) {
            if (!resolvedRoutePayload || resolvedRoutePayload.fullPath !== fullPath) return null;
            if (expectedType && resolvedRoutePayload.type !== expectedType) return null;
            const consumed = resolvedRoutePayload;
            resolvedRoutePayload = null;
            return consumed;
        }

        const { createApp, ref, computed, watch, nextTick, onBeforeUnmount } = Vue;
        const { createRouter, createWebHistory, useRoute, useRouter } = VueRouter;

        const NotFoundView = {
            name: 'NotFoundView',
            setup() {
                consumeInitialPayload('not-found');
                document.title = 'The Justin Blog';
                return {};
            },
            template: `
                <section class="flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center bg-base-200 px-6 py-16 text-center">
                    <h1 class="mb-4 text-5xl font-bold text-accent">404 - Page Not Found</h1>
                    <p class="mb-6 text-lg text-base-content">
                        Oops! The page you're looking for doesn't exist.
                    </p>
                    <router-link to="/" class="btn btn-accent">Go Back to Home</router-link>
                </section>
            `,
        };

        const StaticPageView = {
            name: 'StaticPageView',
            props: {
                text: { type: String, required: true },
            },
            setup(props) {
                consumeInitialPayload('static-page');
                watch(
                    () => props.text,
                    () => {
                        document.title = 'The Justin Blog';
                    },
                    { immediate: true }
                );
                return {};
            },
            template: `
                <div class="mx-auto max-w-4xl px-4 py-12">
                    {{ text }}
                </div>
            `,
        };

        const HeroSection = {
            name: 'HeroSection',
            setup() {
                return {
                    siteName: appConfig.siteName || 'The Justin Blog',
                    socials: appConfig.socials || [],
                };
            },
            template: `
                <div class="hero bg-base-100 not-prose bg-cover bg-center -mt-16">
                    <div class="hero-content pt-24 lg:pt-36 text-center text-base-content">
                        <div class="max-w-4xl bg-base-100/60 backdrop-blur-lg md:p-8 rounded-xl">
                            <router-link to="/" class="no-underline" aria-label="Go to Homepage">
                                <h1 class="text-5xl font-bold text-accent">
                                    {{ siteName }}
                                </h1>
                            </router-link>
                            <nav class="py-6 lg:py-12" aria-label="Social links">
                                <ul class="flex flex-row flex-wrap justify-center gap-4">
                                    <li v-for="social in socials" :key="social.name">
                                        <div class="tooltip tooltip-bottom" :data-tip="social.name">
                                            <a :href="social.url" target="_blank" rel="noopener noreferrer"
                                                class="w-12 h-12 flex items-center justify-center rounded-full border border-base-content/30 hover:border-secondary hover:text-secondary transition-all duration-200 group"
                                                :aria-label="social.name">
                                                <svg v-if="social.name === 'Portfolio'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
                                                    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
                                                    <path d="m10 9-2 2 2 2m4-4 2 2-2 2" />
                                                </svg>
                                                <svg v-else-if="social.name === 'GitHub'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
                                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                                </svg>
                                                <svg v-else-if="social.name === 'Instagram'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
                                                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                                                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                                                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                                                </svg>
                                                <svg v-else-if="social.name === 'Bluesky'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" class="w-6 h-6 group-hover:scale-110 transition-transform duration-200" aria-hidden="true">
                                                    <path d="M3.468 1.948C5.303 3.325 7.276 6.118 8 7.616c.725-1.498 2.698-4.29 4.532-5.668C13.855.955 16 .186 16 2.632c0 .489-.28 4.105-.444 4.692-.572 2.04-2.653 2.561-4.504 2.246 3.236.551 4.06 2.375 2.281 4.2-3.376 3.464-4.852-.87-5.23-1.98-.07-.204-.103-.3-.103-.218 0-.081-.033.014-.102.218-.379 1.11-1.855 5.444-5.231 1.98-1.778-1.825-.955-3.65 2.28-4.2-1.85.315-3.932-.205-4.503-2.246C.28 6.737 0 3.12 0 2.632 0 .186 2.145.955 3.468 1.948"/>
                                                </svg>
                                                <span class="sr-only">
                                                    {{ social.name }} (opens in a new tab)
                                                </span>
                                            </a>
                                        </div>
                                    </li>
                                </ul>
                            </nav>
                            <div class="flex flex-col lg:flex-row items-stretch justify-center w-full gap-2 lg:gap-0">
                                <router-link to="/blog/posts" class="no-underline flex-1 flex flex-col w-full max-w-xl mx-auto group">
                                    <div class="mockup-code text-left transition-all dark:bg-base-300/70 bg-base-300/60 hover:bg-base-300/80 dark:hover:bg-base-300/90 backdrop-blur-xl px-4 sm:px-12 py-8 text-primary flex-1 flex flex-col justify-center border border-secondary/20 hover:border-secondary/50 blog-card-transition">
                                        <div class="flex py-4 text-base transition-all text-base-content font-mono items-start">
                                            <span class="mr-4 select-none text-accent font-bold">$</span>
                                            <span class="text-wrap break-words">read about the lessons I have learned (from the mistakes I have made).</span>
                                        </div>
                                    </div>
                                </router-link>

                                <div class="divider lg:divider-horizontal my-0 lg:mx-4"></div>

                                <router-link to="/climbing" class="no-underline flex-1 flex flex-col w-full max-w-xl mx-auto group">
                                    <div class="card text-left transition-all dark:bg-base-300/70 bg-base-300/60 hover:bg-base-300/80 dark:hover:bg-base-300/90 backdrop-blur-xl px-4 sm:px-12 py-8 text-secondary flex-1 flex flex-col justify-center border border-secondary/20 hover:border-secondary/50 blog-card-transition">
                                        <div class="flex py-4 text-base transition-all text-base-content font-mono items-start">
                                            <span class="mr-4 select-none text-accent shrink-0 inline-flex items-center justify-center h-6">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24"
                                                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                    stroke-linejoin="round" class="w-4 h-4 translate-y-1" aria-hidden="true">
                                                    <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                                                    <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />
                                                </svg>
                                            </span>
                                            <span class="text-wrap break-words">read about my climbing progression, projects, and (hopefully) sends</span>
                                        </div>
                                    </div>
                                </router-link>
                            </div>
                        </div>
                    </div>
                </div>
            `,
        };

        const PostGridCard = {
            name: 'PostGridCard',
            props: {
                blog: { type: Object, required: true },
                isLcp: { type: Boolean, default: false },
            },
            setup() {
                const router = useRouter();
                function navigateToQuery(itemIsClimbing, query) {
                    const path = itemIsClimbing ? '/climbing' : '/blog/posts';
                    router.push({ path, query: { query } });
                }
                return {
                    trackPostClick,
                    navigateToQuery,
                };
            },
            template: `
                <router-link :to="blog.link" class="no-underline group" @click="trackPostClick(blog)">
                    <div class="card dark:bg-base-300/70 bg-base-300/60 hover:bg-base-300/70 dark:hover:bg-base-300/90 backdrop-blur-xl shadow-xl transition-all duration-300 blog-card-transition overflow-hidden rounded-xl border border-secondary/20 hover:border-secondary/50"
                        :style="'--blog-card-id: blog-card-' + blog.id">
                        <figure v-if="blog.gridImageUrl" class="h-auto md:h-48 overflow-hidden m-0 rounded-t-lg relative">
                            <img :src="blog.gridImageUrl" :alt="blog.title"
                                class="w-full h-auto md:h-48 object-cover blog-image-transition rounded-t-lg"
                                :style="'--blog-image-id: blog-image-' + blog.id"
                                width="350" height="192" decoding="async"
                                :fetchpriority="isLcp ? 'high' : null"
                                :loading="isLcp ? null : 'lazy'" />
                            <div v-if="blog.location"
                                @click.prevent.stop="navigateToQuery(blog.itemIsClimbing, blog.location)"
                                class="absolute bottom-3 left-3 flex items-center gap-1.5 py-1 px-2.5 bg-base-100/60 backdrop-blur-md border border-white/20 shadow-md text-base-content text-xs font-medium rounded-full z-10 hover:bg-accent hover:text-accent-content hover:border-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                </svg>
                                {{ blog.location }}
                            </div>
                        </figure>
                        <div class="card-body blog-body-transition p-6">
                            <h2 class="card-title text-xl font-bold text-secondary my-0 blog-title-transition"
                                :style="'--blog-title-id: blog-title-' + blog.id">
                                {{ blog.title }}
                            </h2>
                            <div class="flex flex-wrap gap-2">
                                <span v-for="(badge, badgeIdx) in (blog.badges || [])" :key="badgeIdx + '-' + (badge.text || badge)"
                                    @click.prevent.stop="navigateToQuery(blog.itemIsClimbing, badge.query || badge.text || badge)"
                                    class="badge bg-base-100/60 backdrop-blur-md border border-accent/30 shadow-md text-base-content badge-sm text-nowrap h-auto hover:bg-accent hover:text-accent-content hover:border-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer z-10 relative">
                                    {{ badge.text || badge }}
                                </span>
                            </div>
                            <p class="text-sm text-base-content line-clamp-3">{{ blog.previewText }}</p>
                            <span class="text-xs text-base-content/60 mt-2">{{ blog.formattedDate }}</span>
                        </div>
                    </div>
                </router-link>
            `,
        };

        const BlogListView = {
            name: 'BlogListView',
            components: { HeroSection, PostGridCard },
            props: {
                section: { type: String, required: true },
            },
            setup(props) {
                const route = useRoute();
                const router = useRouter();

                const loading = ref(false);
                const payload = ref(null);
                const searchQuery = ref('');
                const searchInput = ref(null);
                const infiniteTrigger = ref(null);

                const extraPosts = ref([]);
                const infinitePage = ref(1);
                const loadingMore = ref(false);
                const hasMore = ref(false);

                let observer = null;
                let activeController = null;

                const isHomepage = computed(() => props.section === 'home');
                const isClimbing = computed(() => props.section === 'climbing');
                const basePath = computed(() => (isClimbing.value ? '/climbing' : '/blog/posts'));
                const currentPage = computed(() => payload.value?.currentPage || 1);
                const totalPages = computed(() => payload.value?.totalPages || 1);
                const heroPost = computed(() => payload.value?.heroPost || null);
                const hasSearchQuery = computed(() => !!payload.value?.hasSearchQuery);
                const hasNoSearchResults = computed(() => !!payload.value?.hasNoSearchResults);
                const displayQuery = computed(() => payload.value?.rawQuery || payload.value?.query || '');
                const allGridPosts = computed(() => [
                    ...(payload.value?.gridPosts || []),
                    ...extraPosts.value,
                ]);

                function disconnectObserver() {
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                }

                function setupObserver() {
                    disconnectObserver();
                    if (!isHomepage.value || !hasMore.value) return;

                    observer = new IntersectionObserver(
                        (entries) => {
                            if (entries[0] && entries[0].isIntersecting && hasMore.value && !loadingMore.value) {
                                loadMore();
                            }
                        },
                        { threshold: 0.1, rootMargin: '0px' }
                    );

                    nextTick(() => {
                        if (infiniteTrigger.value && observer) {
                            observer.observe(infiniteTrigger.value);
                        }
                    });
                }

                async function loadMore() {
                    if (loadingMore.value || !hasMore.value || !isHomepage.value) return;
                    loadingMore.value = true;
                    try {
                        const nextPage = infinitePage.value + 1;
                        const activeQ = payload.value?.rawQuery || '';
                        const url = `/api/homepage-posts?page=${nextPage}${activeQ ? '&query=' + encodeURIComponent(activeQ) : ''}`;
                        const res = await fetch(url);
                        if (res.ok) {
                            const json = await res.json();
                            if (Array.isArray(json.items) && json.items.length > 0) {
                                const seenIds = new Set();
                                if (heroPost.value && heroPost.value.id) seenIds.add(heroPost.value.id);
                                (payload.value?.gridPosts || []).forEach((p) => p && seenIds.add(p.id));
                                extraPosts.value.forEach((p) => p && seenIds.add(p.id));

                                const normalized = json.items
                                    .map(normalizeExtraItem)
                                    .filter((item) => item && item.id && !seenIds.has(item.id));
                                extraPosts.value.push(...normalized);
                                infinitePage.value = nextPage;
                                hasMore.value = !!json.hasMore;

                                const key = getListCacheKey(props.section, route.query);
                                if (listCache.has(key)) {
                                    setBoundedCache(listCache, key, {
                                        data: payload.value,
                                        extraPosts: [...extraPosts.value],
                                        infinitePage: infinitePage.value,
                                        hasMore: hasMore.value,
                                    }, 25);
                                }
                            } else {
                                hasMore.value = false;
                            }
                        } else {
                            hasMore.value = false;
                        }
                    } catch (err) {
                        console.error('Error loading more posts:', err);
                        hasMore.value = false;
                    } finally {
                        loadingMore.value = false;
                        if (!hasMore.value) disconnectObserver();
                    }
                }

                function applyPayload(data, snapshot) {
                    payload.value = data;
                    searchQuery.value = data.rawQuery || '';
                    if (snapshot) {
                        extraPosts.value = [...(snapshot.extraPosts || [])];
                        infinitePage.value = snapshot.infinitePage || data.currentPage || 1;
                        hasMore.value = !!snapshot.hasMore;
                    } else {
                        extraPosts.value = [];
                        infinitePage.value = data.currentPage || 1;
                        hasMore.value = isHomepage.value && (data.currentPage || 1) < (data.totalPages || 1);
                    }
                    if (data.pageTitle) document.title = data.pageTitle;

                    nextTick(() => {
                        if (!isHomepage.value && searchInput.value && isDesktop()) {
                            try {
                                searchInput.value.focus({ preventScroll: true });
                            } catch (_) {
                                searchInput.value.focus();
                            }
                        }
                        setupObserver();
                    });
                }

                async function loadRouteData() {
                    disconnectObserver();
                    if (activeController) {
                        activeController.abort();
                        activeController = null;
                    }

                    const hydrated = consumeInitialPayload('posts-list', (p) =>
                        p.isHomepage === isHomepage.value && p.isClimbing === isClimbing.value
                    );
                    if (hydrated) {
                        applyPayload(hydrated);
                        return;
                    }

                    const prefetched = consumeResolvedPayload(route.fullPath, 'posts-list');
                    if (prefetched && prefetched.entry) {
                        loading.value = false;
                        applyPayload(prefetched.entry.data, prefetched.entry);
                        return;
                    }

                    loading.value = true;
                    const controller = new AbortController();
                    activeController = controller;

                    try {
                        const entry = await fetchPostsPayload(props.section, route.query, controller.signal);
                        if (controller.signal.aborted) return;
                        applyPayload(entry.data, entry);
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Error loading posts:', err);
                        }
                    } finally {
                        if (activeController === controller) {
                            loading.value = false;
                            activeController = null;
                        }
                    }
                }

                function handleSearch() {
                    const trimmed = searchQuery.value;
                    router.push({
                        path: basePath.value,
                        query: trimmed ? { query: trimmed } : {},
                    });
                }

                function clearSearch() {
                    searchQuery.value = '';
                    if (searchInput.value && isDesktop()) {
                        searchInput.value.focus();
                    }
                    if (route.query.query) {
                        router.push({ path: basePath.value });
                    }
                }

                function navigateToQuery(itemIsClimbing, query) {
                    router.push({
                        path: itemIsClimbing ? '/climbing' : '/blog/posts',
                        query: { query },
                    });
                }

                function pageLocation(targetPage) {
                    const query = {};
                    if (targetPage > 1 || route.query.page) query.page = String(targetPage);
                    if (route.query.query) query.query = String(route.query.query);
                    if (route.query.climbType) query.climbType = String(route.query.climbType);
                    return { path: basePath.value, query };
                }

                watch(
                    () => [props.section, route.fullPath],
                    () => loadRouteData(),
                    { immediate: true }
                );

                onBeforeUnmount(() => {
                    disconnectObserver();
                    if (activeController) activeController.abort();
                });

                return {
                    loading,
                    payload,
                    isHomepage,
                    isClimbing,
                    basePath,
                    searchQuery,
                    searchInput,
                    infiniteTrigger,
                    currentPage,
                    totalPages,
                    heroPost,
                    hasSearchQuery,
                    hasNoSearchResults,
                    displayQuery,
                    allGridPosts,
                    loadingMore,
                    hasMore,
                    handleSearch,
                    clearSearch,
                    navigateToQuery,
                    pageLocation,
                    trackPostClick,
                };
            },
            template: `
                <div>
                    <hero-section v-if="isHomepage" />
                    <div class="bg-base-100 pt-16 flex flex-col justify-between"
                        :class="!isHomepage ? 'min-h-[calc(100vh-12.54rem)]' : 'pb-12'">
                        <div class="max-w-6xl mx-auto px-4 w-full">
                            <div class="text-center">
                                <template v-if="!isHomepage">
                                    <router-link :to="basePath" class="no-underline">
                                        <div class="mt-12 mb-6 text-center">
                                            <h1 class="text-5xl font-bold text-accent">
                                                {{ isClimbing ? 'The Climbing Blog' : 'The Dev Blog' }}
                                            </h1>
                                        </div>
                                    </router-link>
                                    <p class="mt-8 text-lg text-base-content">
                                        {{ isClimbing ? 'A personal record of my falls, projects, and sends (on rock and in the gym).' : 'Explore recent insights, retrospectives, and stories.' }}
                                    </p>
                                    <form role="search" :action="basePath" method="get" @submit.prevent="handleSearch"
                                        class="my-6 flex justify-center w-full">
                                        <div class="relative w-full max-w-xl">
                                            <label for="site-search-input" class="sr-only">
                                                {{ isClimbing ? 'Search climbing logs' : 'Search blog posts' }}
                                            </label>
                                            <input type="text" inputmode="search" role="searchbox" name="query" id="site-search-input"
                                                autocomplete="search" v-model="searchQuery" ref="searchInput"
                                                class="input input-bordered w-full rounded-full bg-base-100 border border-base-content/30 pl-5 pr-24 text-base focus:outline-none focus:ring-2 focus:ring-primary shadow-sm [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden [&::-webkit-search-results-button]:hidden [&::-webkit-search-results-decoration]:hidden"
                                                :placeholder="isClimbing ? 'Search climbs or locations...' : 'Search blogs...'"
                                                :aria-label="isClimbing ? 'Search climbing logs' : 'Search blog posts'"
                                                @keydown.enter.prevent="handleSearch" />
                                            <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1" style="right: 0.75rem;">
                                                <button v-show="searchQuery" @click="clearSearch"
                                                    class="btn btn-ghost btn-xs btn-circle opacity-70 hover:opacity-100 text-base-content"
                                                    type="button" aria-label="Clear search">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                <button type="submit" @click.prevent="handleSearch"
                                                    class="btn btn-primary btn-sm btn-circle shrink-0" aria-label="Submit search">
                                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                    <div v-if="!hasSearchQuery" class="my-8 w-full">
                                        <div class="flex justify-end w-full">
                                            <router-link to="/" class="btn btn-accent btn-sm gap-2 transition-all duration-200 rounded-xl">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                                    fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                                    stroke-linejoin="round" aria-hidden="true">
                                                    <path d="m12 19-7-7 7-7" />
                                                    <path d="M19 12H5" />
                                                </svg>
                                                Back Home
                                            </router-link>
                                        </div>
                                    </div>
                                </template>
                            </div>

                            <div v-if="loading && !payload" class="py-16 flex justify-center">
                                <span class="loading loading-spinner loading-lg text-accent" role="status" aria-label="Loading posts"></span>
                            </div>

                            <template v-else-if="payload">
                                <!-- Hero Post -->
                                <div v-if="heroPost" class="mb-24">
                                    <router-link :to="heroPost.link" class="no-underline group" @click="trackPostClick(heroPost)">
                                        <div class="card w-full lg:card-side dark:bg-base-300/70 bg-base-300/60 hover:bg-base-300/70 dark:hover:bg-base-300/90 backdrop-blur-xl shadow-2xl lg:shadow-xl transition-all duration-300 blog-card-transition overflow-hidden rounded-xl border border-secondary/20 hover:border-secondary/50 relative"
                                            :style="'--blog-card-id: blog-card-' + heroPost.id">
                                            <span
                                                class="absolute py-1 px-2 sm:py-2 sm:px-4 bg-accent/90 backdrop-blur-md border border-accent-content/20 shadow-lg text-accent-content text-xs md:text-sm lg:text-base font-semibold uppercase tracking-wide z-10 rounded-full"
                                                style="position-anchor: --blog-image; bottom:calc(anchor(bottom) + 0.75rem); left:calc(anchor(left) + 0.75rem); view-transition-name: latest-post-badge">Latest Post</span>
                                            <figure v-if="heroPost.heroImageUrl" class="lg:w-1/2 h-auto m-0 rounded-t-lg lg:rounded-t-none lg:rounded-l-lg">
                                                <img :src="heroPost.heroImageUrl" :alt="heroPost.title"
                                                    class="w-full h-full object-cover blog-image-transition rounded-t-lg lg:rounded-t-none lg:rounded-l-lg"
                                                    :style="'--blog-image-id: blog-image-' + heroPost.id + '; anchor-name: --blog-image'"
                                                    width="610" height="407" fetchpriority="high" decoding="async" />
                                            </figure>
                                            <div class="card-body lg:w-1/2 justify-center blog-body-transition p-8 md:p-12">
                                                <h2 class="card-title text-3xl md:text-4xl font-bold text-secondary mt-0 blog-title-transition"
                                                    :style="'--blog-title-id: blog-title-' + heroPost.id">
                                                    {{ heroPost.title }}
                                                </h2>
                                                <div class="flex flex-wrap pb-4 gap-2">
                                                    <span v-for="(badge, idx) in (heroPost.badges || [])" :key="idx"
                                                        @click.prevent.stop="navigateToQuery(heroPost.itemIsClimbing, badge.query || badge.text)"
                                                        class="badge bg-base-100/60 backdrop-blur-md border border-accent/30 shadow-md text-base-content lg:badge-lg text-nowrap hover:bg-accent hover:text-accent-content hover:border-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer z-10 relative">
                                                        {{ badge.text }}
                                                    </span>
                                                </div>
                                                <p class="text-lg text-base-content mt-4 line-clamp-4">
                                                    {{ heroPost.previewText }}
                                                </p>
                                                <span class="text-sm text-base-content/60 block">
                                                    {{ heroPost.formattedDate }}
                                                </span>
                                            </div>
                                        </div>
                                    </router-link>
                                </div>

                                <div v-if="hasNoSearchResults" class="mx-auto max-w-xl py-16 text-center">
                                    <h1 class="mb-4 text-5xl font-bold text-accent">No search results</h1>
                                    <p class="mb-6 text-lg text-base-content">
                                        {{ isClimbing ? 'No climbing entries' : 'No blog posts' }} matched "{{ displayQuery }}".
                                    </p>
                                    <router-link :to="basePath" class="btn btn-primary">Clear Search</router-link>
                                </div>

                                <template v-else>
                                    <div v-if="hasSearchQuery" class="mb-12 pt-8 text-center">
                                        <p class="mb-4 text-lg text-base-content">
                                            Results for <span class="text-lg text-secondary font-semibold">"{{ displayQuery }}"</span>
                                        </p>
                                    </div>
                                    <router-link v-else-if="heroPost" :to="basePath" class="no-underline">
                                        <div class="mb-12 text-center">
                                            <h2 class="text-5xl font-bold text-accent">Older Posts</h2>
                                        </div>
                                    </router-link>

                                    <div class="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                                        <post-grid-card
                                            v-for="(blog, index) in allGridPosts"
                                            :key="blog.id"
                                            :blog="blog"
                                            :is-lcp="!isHomepage && index === 0"
                                        />
                                        <div v-if="isHomepage" id="infinite-scroll-trigger" ref="infiniteTrigger" v-show="hasMore"
                                            class="col-span-full py-8 flex justify-center items-center w-full min-h-[4rem]"
                                            aria-live="polite">
                                            <span v-show="loadingMore"
                                                class="loading loading-spinner loading-lg text-accent"
                                                role="status"
                                                aria-label="Loading more posts"></span>
                                        </div>
                                    </div>
                                </template>
                            </template>
                        </div>

                        <!-- Pagination -->
                        <nav v-if="!isHomepage && !hasNoSearchResults && payload" aria-label="Pagination" class="flex justify-center my-12">
                            <div class="join">
                                <button v-if="currentPage <= 1" class="join-item btn btn-sm btn-disabled"
                                    aria-label="Previous page" disabled aria-disabled="true">«</button>
                                <router-link v-else :to="pageLocation(currentPage - 1)" class="join-item btn btn-sm"
                                    aria-label="Previous page">«</router-link>

                                <router-link v-for="i in totalPages" :key="i" :to="pageLocation(i)"
                                    class="join-item btn btn-sm" :class="{ 'btn-active': currentPage === i }"
                                    :aria-current="currentPage === i ? 'page' : null"
                                    :aria-label="'Page ' + i">
                                    {{ i }}
                                </router-link>

                                <button v-if="currentPage >= totalPages" class="join-item btn btn-sm btn-disabled"
                                    aria-label="Next page" disabled aria-disabled="true">»</button>
                                <router-link v-else :to="pageLocation(currentPage + 1)" class="join-item btn btn-sm"
                                    aria-label="Next page">»</router-link>
                            </div>
                        </nav>
                    </div>
                </div>
            `,
        };

        const BlogDetailView = {
            name: 'BlogDetailView',
            components: { NotFoundView },
            props: {
                isClimbing: { type: Boolean, default: false },
            },
            setup(props) {
                const route = useRoute();
                const router = useRouter();
                const loading = ref(false);
                const post = ref(null);
                const notFound = ref(false);
                let activeController = null;

                async function loadPost() {
                    if (activeController) {
                        activeController.abort();
                        activeController = null;
                    }

                    const hydratedPost = consumeInitialPayload('post-detail', (p) =>
                        !!p.post?.isClimbing === !!props.isClimbing
                    );
                    if (hydratedPost) {
                        post.value = hydratedPost.post;
                        notFound.value = false;
                        if (hydratedPost.pageTitle) document.title = hydratedPost.pageTitle;
                        return;
                    }

                    const hydratedNotFound = consumeInitialPayload('not-found');
                    if (hydratedNotFound) {
                        post.value = null;
                        notFound.value = true;
                        document.title = hydratedNotFound.pageTitle || 'The Justin Blog';
                        return;
                    }

                    const prefetched = consumeResolvedPayload(route.fullPath, 'post-detail');
                    if (prefetched && prefetched.entry) {
                        const entry = prefetched.entry;
                        loading.value = false;
                        if (!entry.found) {
                            post.value = null;
                            notFound.value = true;
                            document.title = entry.data?.pageTitle || 'The Justin Blog';
                        } else {
                            post.value = entry.data.post;
                            notFound.value = false;
                            if (entry.data.pageTitle) document.title = entry.data.pageTitle;
                        }
                        return;
                    }

                    loading.value = true;
                    notFound.value = false;
                    const controller = new AbortController();
                    activeController = controller;

                    try {
                        const entry = await fetchSinglePostPayload(props.isClimbing, route.params, controller.signal);
                        if (controller.signal.aborted) return;
                        const json = entry.data || {};

                        if (!entry.found) {
                            post.value = null;
                            notFound.value = true;
                            document.title = json.pageTitle || 'The Justin Blog';
                            return;
                        }

                        post.value = json.post;
                        notFound.value = false;
                        if (json.pageTitle) document.title = json.pageTitle;

                        if (
                            json.canonicalPath &&
                            safeDecodePath(route.path) !== safeDecodePath(json.canonicalPath)
                        ) {
                            router.replace(json.canonicalPath);
                        }
                    } catch (err) {
                        if (err.name !== 'AbortError') {
                            console.error('Error loading post:', err);
                            notFound.value = true;
                        }
                    } finally {
                        if (activeController === controller) {
                            loading.value = false;
                            activeController = null;
                        }
                    }
                }

                function goBack() {
                    if (window.history.state && window.history.state.back) {
                        router.back();
                    } else {
                        router.push(post.value?.backLink || (props.isClimbing ? '/climbing' : '/blog/posts'));
                    }
                }

                function handleProseClick(event) {
                    const anchor = event.target && event.target.closest ? event.target.closest('a') : null;
                    if (!anchor || !anchor.href) return;
                    if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

                    try {
                        const url = new URL(anchor.href, window.location.origin);
                        if (url.origin !== window.location.origin) return;
                        if (
                            url.pathname.startsWith('/api/') ||
                            url.pathname.startsWith('/_/') ||
                            url.pathname.startsWith('/clippy/') ||
                            url.pathname.endsWith('.xml') ||
                            url.pathname.endsWith('.txt')
                        ) {
                            return;
                        }
                        event.preventDefault();
                        router.push(url.pathname + url.search + url.hash);
                    } catch (_) {}
                }

                watch(
                    () => [props.isClimbing, route.fullPath],
                    () => loadPost(),
                    { immediate: true }
                );

                onBeforeUnmount(() => {
                    if (activeController) activeController.abort();
                });

                return {
                    loading,
                    post,
                    notFound,
                    goBack,
                    handleProseClick,
                };
            },
            template: `
                <not-found-view v-if="notFound" />
                <div v-else-if="loading && !post" class="bg-base-200 py-24 min-h-[calc(100vh-12.54rem)] flex justify-center items-start">
                    <span class="loading loading-spinner loading-lg text-accent" role="status" aria-label="Loading post"></span>
                </div>
                <div v-else-if="post" class="hero bg-base-200 py-12 min-h-[calc(100vh-12.54rem)] flex flex-col items-center justify-start blog-card-transition"
                    :style="'--blog-card-id: blog-card-' + post.id">
                    <div class="hero-content max-w-4xl flex flex-col w-full gap-0">
                        <img v-if="post.imageUrl" :src="post.imageUrl"
                            class="rounded-xl shadow-lg w-full h-auto max-h-96 object-cover m-0 mb-6 blog-image-transition"
                            :style="'--blog-image-id: blog-image-' + post.id + '; aspect-ratio: 16/9;'"
                            :alt="post.title" width="896" height="504" fetchpriority="high" decoding="async" />

                        <div class="w-full pt-6 pb-8 border-b border-base-content/10 flex flex-col gap-4">
                            <h1 class="text-4xl md:text-5xl font-bold text-accent leading-tight blog-title-transition text-center mb-2"
                                :style="'--blog-title-id: blog-title-' + post.id">
                                {{ post.title }}
                            </h1>

                            <div class="flex flex-wrap gap-2">
                                <router-link v-for="(badge, idx) in (post.badges || [])" :key="idx"
                                    :to="{ path: post.isClimbing ? '/climbing' : '/blog/posts', query: { query: badge.query } }"
                                    class="no-underline">
                                    <span class="badge bg-base-100/60 backdrop-blur-md border border-accent/30 shadow-md text-base-content badge-lg text-nowrap hover:bg-accent hover:text-accent-content hover:border-accent hover:shadow-lg hover:shadow-accent/30 hover:-translate-y-0.5 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer group">
                                        <svg v-if="badge.isLocation" xmlns="http://www.w3.org/2000/svg"
                                            class="h-3.5 w-3.5 mr-1 inline-block transition-transform duration-200"
                                            viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                            <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd" />
                                        </svg>
                                        {{ badge.text }}
                                    </span>
                                </router-link>
                            </div>

                            <div class="flex justify-between items-center w-full text-sm text-base-content flex-wrap gap-4">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <button type="button" @click="goBack"
                                        class="btn btn-accent btn-sm gap-2 rounded-full transition-all duration-200">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                                            fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                            stroke-linejoin="round" aria-hidden="true">
                                            <path d="m12 19-7-7 7-7" />
                                            <path d="M19 12H5" />
                                        </svg>
                                        Back
                                    </button>
                                    <router-link :to="post.backLink"
                                        class="btn btn-accent btn-sm gap-2 rounded-full transition-all duration-200">
                                        <svg v-if="post.isClimbing" xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
                                            <path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19" />
                                        </svg>
                                        <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <polyline points="16 18 22 12 16 6" />
                                            <polyline points="8 6 2 12 8 18" />
                                        </svg>
                                        {{ post.backLabel }}
                                    </router-link>
                                </div>
                                <div class="text-right">
                                    {{ post.dateLabel }}:
                                    <strong>{{ post.formattedDate }}</strong>
                                    <div v-if="post.formattedUpdated" class="text-right">
                                        Updated:
                                        <strong>{{ post.formattedUpdated }}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="w-full self-start backdrop-blur-md px-4 sm:px-8 pt-6 pb-8 rounded-xl" @click="handleProseClick">
                            <div class="prose max-w-none text-base-content min-w-0 w-full font-normal leading-relaxed"
                                v-html="post.cleanContent"></div>
                            <div v-if="post.cleanContent2"
                                class="prose max-w-none text-base-content mt-6 min-w-0 w-full font-normal leading-relaxed"
                                v-html="post.cleanContent2"></div>
                        </div>
                    </div>
                </div>
            `,
        };

        const routes = [
            { path: '/', name: 'home', component: BlogListView, props: { section: 'home' } },
            { path: '/blog', redirect: '/blog/posts' },
            { path: '/blog/posts', name: 'blog-list', component: BlogListView, props: { section: 'blog' } },
            { path: '/blog/posts/:title/:id', name: 'blog-detail', component: BlogDetailView, props: { isClimbing: false } },
            { path: '/blog/posts/:title', name: 'blog-legacy', component: BlogDetailView, props: { isClimbing: false } },
            { path: '/climbing', name: 'climbing-list', component: BlogListView, props: { section: 'climbing' } },
            { path: '/climbing/:title/:id', name: 'climbing-detail', component: BlogDetailView, props: { isClimbing: true } },
            { path: '/climbing/:title', name: 'climbing-legacy', component: BlogDetailView, props: { isClimbing: true } },
            { path: '/faq', name: 'faq', component: StaticPageView, props: { text: 'faq' } },
            { path: '/privacy', name: 'privacy', component: StaticPageView, props: { text: 'privacy' } },
            { path: '/terms', name: 'terms', component: StaticPageView, props: { text: 'terms of service' } },
            { path: '/pagenotfound', name: 'pagenotfound', component: NotFoundView },
            { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFoundView },
        ];

        let pendingViewUpdateResolve = null;
        let pendingFallbackTimer = null;
        let navSeq = 0;
        let activeNavController = null;

        function resolvePendingViewUpdate() {
            if (pendingFallbackTimer) {
                clearTimeout(pendingFallbackTimer);
                pendingFallbackTimer = null;
            }
            if (pendingViewUpdateResolve) {
                const fn = pendingViewUpdateResolve;
                pendingViewUpdateResolve = null;
                fn();
            }
        }

        async function prefetchTargetRoute(to, from, signal) {
            resolvedRoutePayload = null;

            if (to.name === 'home' || to.name === 'blog-list' || to.name === 'climbing-list') {
                const section = to.name === 'home' ? 'home' : (to.name === 'climbing-list' ? 'climbing' : 'blog');
                const entry = await fetchPostsPayload(section, to.query, signal);
                if (signal.aborted) return null;

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
                if (signal.aborted) return null;

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

        const router = createRouter({
            history: createWebHistory(),
            routes,
            scrollBehavior(to, from, savedPosition) {
                let target = { top: 0, behavior: 'instant' };
                if (savedPosition) target = Object.assign({}, savedPosition, { behavior: 'instant' });
                else if (to.hash) target = { el: to.hash, behavior: 'smooth' };
                queueMicrotask(() => {
                    queueMicrotask(resolvePendingViewUpdate);
                });
                return target;
            },
        });

        const drawerOpen = ref(false);
        const currentTheme = ref(document.documentElement.getAttribute('data-theme') === 'nord' ? 'nord' : 'dark');

        router.beforeResolve(async (to, from) => {
            if (from === VueRouter.START_LOCATION) {
                seedCacheFromInitial(to);
                return true;
            }

            const seq = ++navSeq;
            if (activeNavController) {
                activeNavController.abort();
            }
            const controller = new AbortController();
            activeNavController = controller;

            try {
                const redirectTarget = await prefetchTargetRoute(to, from, controller.signal);
                if (seq !== navSeq || controller.signal.aborted) {
                    return false;
                }
                if (redirectTarget) {
                    return redirectTarget;
                }
            } catch (err) {
                if (err && err.name === 'AbortError') return false;
                console.error('Error preparing route:', err);
            } finally {
                if (activeNavController === controller) {
                    activeNavController = null;
                }
            }

            if (seq !== navSeq) return false;

            const samePageHashOnly =
                to.path === from.path &&
                JSON.stringify(to.query) === JSON.stringify(from.query) &&
                to.hash !== from.hash;

            const reducedMotion =
                typeof window.matchMedia === 'function' &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            if (
                samePageHashOnly ||
                reducedMotion ||
                typeof document.startViewTransition !== 'function'
            ) {
                return true;
            }

            resolvePendingViewUpdate();

            await new Promise((allowCommit) => {
                let committed = false;
                const commitOnce = () => {
                    if (!committed) {
                        committed = true;
                        allowCommit();
                    }
                };
                const startTimer = setTimeout(commitOnce, 200);

                try {
                    const transition = document.startViewTransition(() => {
                        clearTimeout(startTimer);
                        const updateDone = new Promise((resolve) => {
                            pendingViewUpdateResolve = resolve;
                            pendingFallbackTimer = setTimeout(resolvePendingViewUpdate, 600);
                        });
                        commitOnce();
                        return updateDone;
                    });
                    if (transition && transition.finished) {
                        transition.finished.catch(() => {});
                    }
                } catch (_) {
                    clearTimeout(startTimer);
                    commitOnce();
                }
            });

            return true;
        });

        router.onError(() => {
            resolvePendingViewUpdate();
        });

        router.afterEach((to, from, failure) => {
            drawerOpen.value = false;
            if (failure) {
                resolvePendingViewUpdate();
                return;
            }
            if (from !== VueRouter.START_LOCATION && typeof window.gtag === 'function') {
                nextTick(() => {
                    window.gtag('event', 'page_view', {
                        page_path: to.fullPath,
                        page_title: document.title,
                        page_location: window.location.href,
                    });
                });
            }
        });

        window.addEventListener('pageshow', () => {
            currentTheme.value = document.documentElement.getAttribute('data-theme') === 'nord' ? 'nord' : 'dark';
        });

        const app = createApp({
            setup() {
                function onToggleTheme() {
                    if (typeof window.toggleTheme === 'function') {
                        window.toggleTheme();
                    }
                    currentTheme.value = document.documentElement.getAttribute('data-theme') === 'nord' ? 'nord' : 'dark';
                }

                return {
                    navigation: appConfig.navigation || [],
                    socials: appConfig.socials || [],
                    currentYear: appConfig.currentYear || new Date().getFullYear(),
                    drawerOpen,
                    currentTheme,
                    onToggleTheme,
                };
            },
            template: `
                <a href="#main-content" class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-4 focus:left-4 focus:p-4 focus:bg-primary focus:text-primary-content focus:rounded-md focus:shadow-lg">Skip to main content</a>
                <div class="drawer flex-1">
                    <input id="my-drawer-3" v-model="drawerOpen" type="checkbox" class="drawer-toggle" aria-label="Toggle navigation drawer" />
                    <div class="drawer-content flex min-h-full flex-col">
                        <nav class="navbar dark:bg-base-300/70 bg-base-300/60 backdrop-blur-xl w-full fixed top-0 left-0 right-0 z-40 navbar-persistent"
                            aria-label="Main Navigation">
                            <div class="flex-none lg:hidden">
                                <label for="my-drawer-3" aria-label="Open sidebar menu" class="btn btn-square btn-ghost">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                        class="inline-block h-6 w-6 stroke-current" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </label>
                            </div>
                            <div class="menu menu-horizontal mx-2 flex-1 px-2">
                                <router-link to="/"
                                    class="font-medium hover:text-secondary transition-colors duration-200 no-underline text-base-content"
                                    :aria-current="$route.path === '/' ? 'page' : 'false'">Home</router-link>
                            </div>
                            <div class="hidden flex-none lg:flex items-center gap-6 px-2 text-sm">
                                <router-link v-for="item in navigation" :key="item.url" :to="item.url"
                                    class="font-medium hover:text-secondary transition-colors duration-200 no-underline"
                                    :class="$route.path === item.url ? 'text-accent' : 'text-base-content'">
                                    {{ item.title }}
                                </router-link>
                            </div>
                            <div class="flex-none ml-2">
                                <button @click="onToggleTheme" type="button"
                                    class="flex items-center justify-center group cursor-pointer bg-transparent p-2 rounded-xl border border-transparent hover:border-accent/50 transition-all duration-200"
                                    aria-label="Toggle theme">
                                    <svg id="theme-icon-sun" v-show="currentTheme === 'dark'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                        class="h-5 w-5 fill-transparent stroke-accent group-hover:fill-accent group-hover:scale-110 transition-all duration-200"
                                        aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    <svg id="theme-icon-moon" v-show="currentTheme === 'nord'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                        class="h-5 w-5 fill-transparent stroke-accent group-hover:fill-accent group-hover:scale-110 transition-all duration-200"
                                        aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                                    </svg>
                                </button>
                            </div>
                        </nav>
                        <main id="main-content" tabindex="-1" class="prose max-w-none flex-1 pt-16">
                            <router-view></router-view>
                        </main>
                    </div>
                    <div class="drawer-side z-50">
                        <label for="my-drawer-3" aria-label="Close sidebar navigation" class="drawer-overlay"></label>
                        <nav aria-label="Mobile Navigation" class="min-h-full w-80 bg-base-200/80 backdrop-blur-md p-4">
                            <ul class="menu">
                                <li v-for="item in navigation" :key="item.url">
                                    <router-link :to="item.url" @click="drawerOpen = false">
                                        {{ item.title }}
                                    </router-link>
                                </li>
                            </ul>
                        </nav>
                    </div>
                </div>
                <footer class="dark:bg-base-300/70 bg-base-300/60 backdrop-blur-xl border-t border-base-content/10">
                    <div class="py-10 border-base-300 text-center text-sm text-base-content flex flex-col items-center justify-center px-14 gap-4">
                        <nav aria-label="Social media links">
                            <ul class="text-base-content text-sm flex gap-6 flex-row flex-wrap justify-center items-center">
                                <li v-for="social in socials" :key="social.name">
                                    <a :href="social.url" target="_blank" rel="noopener noreferrer"
                                        class="font-medium text-base-content hover:text-secondary transition-colors duration-200 no-underline">
                                        {{ social.name }}
                                        <span class="sr-only">(opens in a new tab)</span>
                                    </a>
                                </li>
                            </ul>
                        </nav>
                        <p class="opacity-60">&copy; {{ currentYear }} Justin K. All rights reserved.</p>
                    </div>
                </footer>
            `,
        });

        app.use(router);
        router.isReady().then(() => {
            app.mount(mountEl);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initApp);
    } else {
        initApp();
    }
})();
