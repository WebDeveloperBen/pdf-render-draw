type TargetLike =
  | HTMLElement
  | Window
  | Document
  | null
  | undefined
  | MaybeRefOrGetter<HTMLElement | Window | Document | null | undefined>;

export interface UseScrollspyOptions {
  /** Container that actually scrolls (ref or element). Omit to use `window`. */
  target?: TargetLike;
  /** Element containing the ANCHORS (ref or element). If omitted, use the returned `root` ref. */
  root?: HTMLElement | null | Ref<HTMLElement | null | undefined>;
  /** Base data-* name -> anchors should have `data-[name]-anchor="sectionId"`. */
  dataAttribute?: string;
  /** Default offset from top (px) when computing active section / scrolling. */
  offset?: number;
  /** Smooth scroll on click. */
  smooth?: boolean;
  /** Update URL hash as active section changes. */
  history?: boolean;
  /** Throttle time (ms) for scroll handler. */
  throttleTime?: number;
  /** Optional callback when active id changes (you can also watch `activeId`). */
  onChange?: (id: string) => void;
}

export function useScrollspy(options: UseScrollspyOptions = {}) {
  const {
    target,
    root: rootOpt,
    dataAttribute = "scrollspy",
    offset = 0,
    smooth = true,
    history = true,
    throttleTime = 50,
    onChange,
  } = options;

  // Anchors live inside this container; use returned `root` if none passed
  const root = (rootOpt ?? ref<HTMLElement | null>(null)) as Ref<HTMLElement | null>;
  const anchors = shallowRef<Element[]>([]);
  const activeId = ref<string | null>(null);
  const prevId = ref<string | null>(null);

  // --- Resolve the scroller (window by default) ---
  const scroller = shallowRef<Window | HTMLElement>(window as any);

  function sectionTopWithinScroller(sectionEl: HTMLElement): number {
    const se = scroller.value;
    const rect = sectionEl.getBoundingClientRect();
    if (se === window) {
      return rect.top + (window.scrollY || document.documentElement.scrollTop);
    } else {
      const scRect = (se as HTMLElement).getBoundingClientRect();
      return rect.top - scRect.top + (se as HTMLElement).scrollTop;
    }
  }

  function resolveScroller() {
    const t = unrefElement(target as any);
    if (!t || t === window || t === document) {
      scroller.value = window;
    } else if (t instanceof HTMLElement) {
      // Prefer explicitly passed element; if not scrollable, still use it
      scroller.value = t;
    } else {
      scroller.value = window;
    }
  }

  onMounted(resolveScroller);
  watch(() => unrefElement(target as any), resolveScroller, { immediate: true });

  // --- Discover anchors inside `root` and keep updated on DOM changes ---
  function queryAnchors() {
    anchors.value = root.value
      ? Array.from(root.value.querySelectorAll(`[data-${dataAttribute}-anchor]`))
      : [];
  }
  onMounted(queryAnchors);
  useMutationObserver(root, queryAnchors, { childList: true, subtree: true });

  // Helpers for scroll metrics
  function getScrollTop(se: Window | HTMLElement) {
    return se === window
      ? window.scrollY || document.documentElement.scrollTop
      : (se as HTMLElement).scrollTop;
  }
  function getScrollHeight(se: Window | HTMLElement) {
    return se === window ? document.documentElement.scrollHeight : (se as HTMLElement).scrollHeight;
  }
  function getClientHeight(se: Window | HTMLElement) {
    return se === window ? window.innerHeight : (se as HTMLElement).clientHeight;
  }

  // --- Core: compute active anchor on scroll ---
  function setActive(sectionId: string | null, force = false) {
    if (!sectionId) return;

    anchors.value.forEach((el) => {
      const id = el.getAttribute(`data-${dataAttribute}-anchor`);
      if (id === sectionId) el.setAttribute("data-active", "true");
      else el.removeAttribute("data-active");
    });

    if (history && (force || prevId.value !== sectionId)) {
      window.history.replaceState({}, "", `#${sectionId}`);
    }

    if (prevId.value !== sectionId) {
      activeId.value = sectionId;
      onChange?.(sectionId);
      prevId.value = sectionId;
    }
  }

  function handleScroll() {
    if (!anchors.value.length) return;

    const se = scroller.value;
    const scrollTop = getScrollTop(se);

    let activeIdx = 0;
    let minDelta = Infinity;

    anchors.value.forEach((anchor, idx) => {
      const sectionId = anchor.getAttribute(`data-${dataAttribute}-anchor`);
      if (!sectionId) return;
      const sectionEl = document.getElementById(sectionId);
      if (!sectionEl) return;

      let customOffset = offset;
      const dataOffset = anchor.getAttribute(`data-${dataAttribute}-offset`);
      if (dataOffset) customOffset = parseInt(dataOffset, 10);

      const top = sectionTopWithinScroller(sectionEl) - customOffset;
      const delta = Math.abs(top - scrollTop);

      if (top <= scrollTop && delta < minDelta) {
        minDelta = delta;
        activeIdx = idx;
      }
    });

    // At bottom → force last anchor active
    const atBottom = scrollTop + getClientHeight(se) >= getScrollHeight(se) - 2;
    if (atBottom) activeIdx = anchors.value.length - 1;

    const activeAnchor = anchors.value[activeIdx];
    const id = activeAnchor?.getAttribute(`data-${dataAttribute}-anchor`) || null;
    setActive(id);

    // Safety: only one active
    anchors.value.forEach((el, idx) => {
      if (idx !== activeIdx) el.removeAttribute("data-active");
    });
  }

  const onScroll = throttleTime
    ? useThrottleFn(handleScroll, throttleTime, true, false)
    : handleScroll;

  // Rebind when scroller changes
  useEventListener(scroller, "scroll", onScroll, { passive: true });

  // --- Click to scroll ---
  function scrollTo(
    idOrEl: string | HTMLElement,
    behavior: ScrollBehavior = smooth ? "smooth" : "auto"
  ) {
    const se = scroller.value;
    let anchorEl: HTMLElement | null = null;
    let sectionId: string | null = null;

    if (typeof idOrEl === "string") {
      sectionId = idOrEl;
      anchorEl = anchors.value.find(
        (a) => a.getAttribute(`data-${dataAttribute}-anchor`) === idOrEl
      ) as HTMLElement | null;
    } else {
      anchorEl = idOrEl;
      sectionId = anchorEl.getAttribute(`data-${dataAttribute}-anchor`)?.replace("#", "") || null;
    }
    if (!sectionId) return;

    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    let customOffset = offset;
    const dataOffset = anchorEl?.getAttribute?.(`data-${dataAttribute}-offset`);
    if (dataOffset) customOffset = parseInt(dataOffset, 10);

    const top = sectionTopWithinScroller(sectionEl) - customOffset;

    if ("scrollTo" in se) {
      (se as any).scrollTo({ top, left: 0, behavior });
    } else {
      window.scrollTo({ top, left: 0, behavior });
    }
    setActive(sectionId, true);
  }

  // Bind click listeners to anchors and auto-clean when the list changes
  watch(
    anchors,
    (list, _old, onCleanup) => {
      const stops: Array<() => void> = [];
      list.forEach((el) => {
        stops.push(
          useEventListener(el, "click", (e) => {
            e.preventDefault();
            scrollTo(el as HTMLElement);
          })
        );
      });
      onCleanup(() => stops.forEach((s) => s()));
    },
    { immediate: true }
  );

  // Initial sync after mount
  onMounted(() => {
    // If URL has a hash, scroll there
    const raw = window.location.hash.replace("#", "");
    if (raw) {
      const safe = window.CSS && "escape" in window.CSS ? (window.CSS as any).escape(raw) : raw;
      const targetAnchor = root.value?.querySelector(
        `[data-${dataAttribute}-anchor="${safe}"]`
      ) as HTMLElement | null;
      if (targetAnchor) scrollTo(targetAnchor, "auto");
    }
    // Then compute the initial active anchor
    setTimeout(() => onScroll(), 60);
  });

  return {
    /** Container that holds the anchors (use this if you didn't pass `root`) */
    root,
    /** Currently active section id */
    activeId,
    /** Programmatically scroll to a section id or anchor element */
    scrollTo,
    /** Force recompute (e.g., after dynamic layout changes) */
    recompute: () => handleScroll(),
  };
}
