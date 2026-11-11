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

    function initApp() {
        if (typeof Vue === 'undefined' || typeof VueRouter === 'undefined' || !window.BlogComponents) return;
        const mountEl = document.getElementById('app');
        const initialScriptEl = document.getElementById('initial-route-data');
        if (!mountEl || !initialScriptEl) return;

        const {
            trackPostClick,
            AppIcon,
            PostBadgeList,
            PostGridCard,
            HeroSection,
            SearchBar,
            PaginationNav,
            SiteNavbar,
            SiteSidebar,
            SiteFooter,
            NotFoundView,
            StaticPageView,
        } = window.BlogComponents;

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

        const BlogListView = {
            name: 'BlogListView',
            components: {
                HeroSection,
                PostGridCard,
                PostBadgeList,
                SearchBar,
                PaginationNav,
                AppIcon,
            },
            props: {
                section: { type: String, required: true },
            },
            setup(props) {
                const route = useRoute();
                const router = useRouter();

                const loading = ref(false);
                const payload = ref(null);
                const searchQuery = ref('');
                const searchBarRef = ref(null);
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

                                const freshItems = json.items.filter(
                                    (item) => item && item.id && !seenIds.has(item.id)
                                );
                                extraPosts.value.push(...freshItems);
                                infinitePage.value = nextPage;
                                hasMore.value = !!json.hasMore;

                                const key = getListCacheKey(props.section, route.query);
                                if (listCache.has(key)) {
                                    setBoundedCache(
                                        listCache,
                                        key,
                                        {
                                            data: payload.value,
                                            extraPosts: [...extraPosts.value],
                                            infinitePage: infinitePage.value,
                                            hasMore: hasMore.value,
                                        },
                                        25
                                    );
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
                        if (!isHomepage.value && searchBarRef.value && isDesktop()) {
                            searchBarRef.value.focusInput({ preventScroll: true });
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

                    const hydrated = consumeInitialPayload(
                        'posts-list',
                        (p) => p.isHomepage === isHomepage.value && p.isClimbing === isClimbing.value
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
                    if (searchBarRef.value && isDesktop()) {
                        searchBarRef.value.focusInput();
                    }
                    if (route.query.query) {
                        router.push({ path: basePath.value });
                    }
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
                    siteName: appConfig.siteName || 'The Justin Blog',
                    socials: appConfig.socials || [],
                    loading,
                    payload,
                    isHomepage,
                    isClimbing,
                    basePath,
                    searchQuery,
                    searchBarRef,
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
                    pageLocation,
                    trackPostClick,
                };
            },
            template: `
                <div>
                    <hero-section v-if="isHomepage" :site-name="siteName" :socials="socials" />
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
                                    <search-bar
                                        ref="searchBarRef"
                                        v-model="searchQuery"
                                        :action="basePath"
                                        :placeholder="isClimbing ? 'Search climbs or locations...' : 'Search blogs...'"
                                        :label="isClimbing ? 'Search climbing logs' : 'Search blog posts'"
                                        @submit="handleSearch"
                                        @clear="clearSearch"
                                    />
                                    <div v-if="!hasSearchQuery" class="my-8 w-full">
                                        <div class="flex justify-end w-full">
                                            <router-link to="/" class="btn btn-accent btn-sm gap-2 transition-all duration-200 rounded-xl">
                                                <app-icon name="back" />
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
                                        <div class="card w-full lg:card-side glass-card shadow-2xl lg:shadow-xl blog-card-transition overflow-hidden rounded-xl relative"
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
                                                <post-badge-list
                                                    :badges="heroPost.badges || []"
                                                    :item-is-climbing="!!heroPost.itemIsClimbing"
                                                    size-class="lg:badge-lg"
                                                    wrap-class="flex flex-wrap pb-4 gap-2"
                                                    :stop-propagation="true"
                                                />
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

                        <pagination-nav
                            v-if="!isHomepage && !hasNoSearchResults && payload"
                            :current-page="currentPage"
                            :total-pages="totalPages"
                            :page-location="pageLocation"
                        />
                    </div>
                </div>
            `,
        };

        const BlogDetailView = {
            name: 'BlogDetailView',
            components: { NotFoundView, PostBadgeList, AppIcon },
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

                    const hydratedPost = consumeInitialPayload(
                        'post-detail',
                        (p) => !!p.post?.isClimbing === !!props.isClimbing
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
                        document.title = hydratedNotFound.pageTitle || appConfig.siteName || 'The Justin Blog';
                        return;
                    }

                    const prefetched = consumeResolvedPayload(route.fullPath, 'post-detail');
                    if (prefetched && prefetched.entry) {
                        const entry = prefetched.entry;
                        loading.value = false;
                        if (!entry.found) {
                            post.value = null;
                            notFound.value = true;
                            document.title = entry.data?.pageTitle || appConfig.siteName || 'The Justin Blog';
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
                            document.title = json.pageTitle || appConfig.siteName || 'The Justin Blog';
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
                    siteName: appConfig.siteName || 'The Justin Blog',
                    loading,
                    post,
                    notFound,
                    goBack,
                    handleProseClick,
                };
            },
            template: `
                <not-found-view v-if="notFound" :site-name="siteName" />
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

                            <post-badge-list
                                :badges="post.badges || []"
                                :item-is-climbing="!!post.isClimbing"
                                size-class="badge-lg"
                                wrap-class="flex flex-wrap gap-2"
                                :stop-propagation="false"
                            />

                            <div class="flex justify-between items-center w-full text-sm text-base-content flex-wrap gap-4">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <button type="button" @click="goBack"
                                        class="btn btn-accent btn-sm gap-2 rounded-full transition-all duration-200">
                                        <app-icon name="back" />
                                        Back
                                    </button>
                                    <router-link :to="post.backLink"
                                        class="btn btn-accent btn-sm gap-2 rounded-full transition-all duration-200">
                                        <app-icon :name="post.isClimbing ? 'mountain' : 'code'" />
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

        const siteTitle = appConfig.siteName || 'The Justin Blog';
        const routes = [
            { path: '/', name: 'home', component: BlogListView, props: { section: 'home' } },
            { path: '/blog', redirect: '/blog/posts' },
            { path: '/blog/posts', name: 'blog-list', component: BlogListView, props: { section: 'blog' } },
            { path: '/blog/posts/:title/:id', name: 'blog-detail', component: BlogDetailView, props: { isClimbing: false } },
            { path: '/blog/posts/:title', name: 'blog-legacy', component: BlogDetailView, props: { isClimbing: false } },
            { path: '/climbing', name: 'climbing-list', component: BlogListView, props: { section: 'climbing' } },
            { path: '/climbing/:title/:id', name: 'climbing-detail', component: BlogDetailView, props: { isClimbing: true } },
            { path: '/climbing/:title', name: 'climbing-legacy', component: BlogDetailView, props: { isClimbing: true } },
            {
                path: '/faq',
                name: 'faq',
                component: StaticPageView,
                props: { text: 'faq', siteName: siteTitle, onEnter: () => consumeInitialPayload('static-page') },
            },
            {
                path: '/privacy',
                name: 'privacy',
                component: StaticPageView,
                props: { text: 'privacy', siteName: siteTitle, onEnter: () => consumeInitialPayload('static-page') },
            },
            {
                path: '/terms',
                name: 'terms',
                component: StaticPageView,
                props: { text: 'terms of service', siteName: siteTitle, onEnter: () => consumeInitialPayload('static-page') },
            },
            {
                path: '/pagenotfound',
                name: 'pagenotfound',
                component: NotFoundView,
                props: { siteName: siteTitle, onEnter: () => consumeInitialPayload('not-found') },
            },
            {
                path: '/:pathMatch(.*)*',
                name: 'not-found',
                component: NotFoundView,
                props: { siteName: siteTitle, onEnter: () => consumeInitialPayload('not-found') },
            },
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

        const syncThemeState = (evt) => {
            if (evt && typeof evt.detail === 'string') {
                currentTheme.value = evt.detail === 'nord' ? 'nord' : 'dark';
                return;
            }
            currentTheme.value = document.documentElement.getAttribute('data-theme') === 'nord' ? 'nord' : 'dark';
        };
        window.addEventListener('pageshow', syncThemeState);
        window.addEventListener('theme-change', syncThemeState);

        const app = createApp({
            components: { SiteNavbar, SiteSidebar, SiteFooter },
            setup() {
                function onToggleTheme() {
                    if (typeof window.toggleTheme === 'function') {
                        window.toggleTheme();
                    }
                    syncThemeState();
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
                        <site-navbar :navigation="navigation" :current-theme="currentTheme" @toggle-theme="onToggleTheme" />
                        <main id="main-content" tabindex="-1" class="prose max-w-none flex-1 pt-16">
                            <router-view></router-view>
                        </main>
                    </div>
                    <site-sidebar :navigation="navigation" @close="drawerOpen = false" />
                </div>
                <site-footer :socials="socials" :current-year="currentYear" />
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
