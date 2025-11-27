<template>
  <!-- Wrap only the ANCHORS (links/buttons) inside this component -->
  <div ref="root" data-slot="scrollspy" v-bind="$attrs" :class="props.class">
    <slot />
  </div>
</template>

<script setup lang="ts">
  import { unrefElement, useEventListener, useMutationObserver, useThrottleFn } from "@vueuse/core";
  import type { HTMLAttributes } from "vue";

  type TargetLike = HTMLElement | Window | Document | null | undefined;

  const props = withDefaults(
    defineProps<{
      /** Optional scroll container (pass a ref to a scrollable element). Defaults to window. */
      target?: MaybeRefOrGetter<TargetLike>;
      /** Default offset in px from the top when computing active section / scrolling. */
      offset?: number;
      /** Smooth scrolling on anchor click. */
      smooth?: boolean;
      /** Base data-* attribute, e.g. data-scrollspy-anchor. */
      dataAttribute?: string;
      /** Reflect active id in URL hash. */
      history?: boolean;
      /** Throttle time (ms) for scroll handler. */
      throttleTime?: number;
      /** Optional callback on change (also emits 'change'). */
      onUpdate?: (id: string) => void;
      /**
       * Additional classes to apply to the wrapper element.
       */
      class?: HTMLAttributes["class"];
    }>(),
    {
      offset: 0,
      smooth: true,
      dataAttribute: "scrollspy",
      history: true,
      throttleTime: 50,
    }
  );

  const emit = defineEmits<{ (e: "change", id: string): void }>();

  const root = ref<HTMLDivElement | null>(null);
  const anchors = shallowRef<Element[]>([]);
  const prevId = ref<string | null>(null);

  /* ------------------------------- scroller -------------------------------- */
  const scroller = shallowRef<Window | HTMLElement>(window as any);

  function resolveScroller() {
    const t = unrefElement(props.target as any);
    scroller.value = !t || t === document || t === window ? window : (t as HTMLElement);
  }
  onMounted(resolveScroller);
  watch(() => unrefElement(props.target as any), resolveScroller, { immediate: true });

  /* ------------------------------ discovery -------------------------------- */
  function queryAnchors() {
    anchors.value = root.value
      ? Array.from(root.value.querySelectorAll(`[data-${props.dataAttribute}-anchor]`))
      : [];
  }
  onMounted(queryAnchors);
  useMutationObserver(root, queryAnchors, { childList: true, subtree: true });

  /* ----------------------------- calculations ------------------------------ */
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
  /** section top relative to scroller's content */
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

  /* ------------------------------ core logic -------------------------------- */
  function setActive(sectionId: string | null, force = false) {
    if (!sectionId) return;

    anchors.value.forEach((el) => {
      const id = el.getAttribute(`data-${props.dataAttribute}-anchor`);
      if (id === sectionId) el.setAttribute("data-active", "true");
      else el.removeAttribute("data-active");
    });

    if (props.history && (force || prevId.value !== sectionId)) {
      window.history.replaceState({}, "", `#${sectionId}`);
    }

    if (prevId.value !== sectionId) {
      props.onUpdate?.(sectionId);
      emit("change", sectionId);
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
      const sectionId = anchor.getAttribute(`data-${props.dataAttribute}-anchor`);
      if (!sectionId) return;
      const sectionEl = document.getElementById(sectionId);
      if (!sectionEl) return;

      let customOffset = props.offset;
      const dataOffset = anchor.getAttribute(`data-${props.dataAttribute}-offset`);
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
    const sectionId = activeAnchor?.getAttribute(`data-${props.dataAttribute}-anchor`) || null;
    setActive(sectionId);

    // Safety: ensure only one active
    anchors.value.forEach((el, idx) => {
      if (idx !== activeIdx) el.removeAttribute("data-active");
    });
  }

  const onScroll = props.throttleTime
    ? useThrottleFn(handleScroll, props.throttleTime, true, false)
    : handleScroll;

  // Attach scroll listener to current scroller (reactive to scroller changes)
  useEventListener(scroller, "scroll", onScroll, { passive: true });

  /* ------------------------------ navigation -------------------------------- */
  function scrollToAnchor(anchorEl: HTMLElement, ev?: Event) {
    if (ev) ev.preventDefault();

    const raw = anchorEl.getAttribute(`data-${props.dataAttribute}-anchor`) || "";
    const sectionId = raw.replace("#", "");
    if (!sectionId) return;

    const sectionEl = document.getElementById(sectionId);
    if (!sectionEl) return;

    const se = scroller.value;
    let customOffset = props.offset;
    const dataOffset = anchorEl.getAttribute(`data-${props.dataAttribute}-offset`);
    if (dataOffset) customOffset = parseInt(dataOffset, 10);

    const top = sectionTopWithinScroller(sectionEl) - customOffset;

    if ("scrollTo" in se) {
      (se as any).scrollTo({
        top,
        left: 0,
        behavior: props.smooth ? "smooth" : "auto",
      });
    } else {
      window.scrollTo({ top, left: 0, behavior: props.smooth ? "smooth" : "auto" });
    }

    setActive(sectionId, true);
  }

  // Bind click listeners to anchors and auto-cleanup when list changes
  watch(anchors, (list, _, onCleanup) => {
    const stops: Array<() => void> = [];
    list.forEach((el) => {
      stops.push(useEventListener(el, "click", (e) => scrollToAnchor(el as HTMLElement, e)));
    });
    onCleanup(() => stops.forEach((s) => s()));
  });

  /* ------------------------------ initial sync ------------------------------ */
  onMounted(() => {
    // Delay to let layout settle (mirrors your React timeouts)
    setTimeout(() => {
      // If URL has a hash, scroll there
      const raw = window.location.hash.replace("#", "");
      if (raw) {
        const target = root.value?.querySelector(
          `[data-${props.dataAttribute}-anchor="${raw}"]`
        ) as HTMLElement | null;
        if (target) scrollToAnchor(target);
      }
      // Then compute the initial active anchor
      setTimeout(() => onScroll(), 80);
    }, 80);
  });
</script>
