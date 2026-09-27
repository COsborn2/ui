"use client";

import { useCallback, useRef, useState } from "react";

interface EscapeLayer {
  order: number;
  dismiss: () => void;
  document?: Document;
}

const escapeLayers = new WeakMap<Document, EscapeLayer[]>();
const interactionLayers = new WeakMap<Event, EscapeLayer>();
let nextEscapeLayerOrder = 0;

function register(layer: EscapeLayer, document: Document) {
  const layers = escapeLayers.get(document) ?? [];
  // Ref refreshes retain their opening order, even if a lower layer re-renders.
  if (!layer.order) layer.order = ++nextEscapeLayerOrder;
  const later = layers.findIndex((entry) => entry.order > layer.order);
  layers.splice(later < 0 ? layers.length : later, 0, layer);
  escapeLayers.set(document, layers);
  layer.document = document;
}

function unregister(layer: EscapeLayer) {
  const document = layer.document;
  const layers = document && escapeLayers.get(document);
  if (document && layers) {
    layers.splice(layers.indexOf(layer), 1);
    if (!layers.length) escapeLayers.delete(document);
  }
  layer.document = undefined;
}

/** Synchronize shared overlays before Radix hands off its passive listeners. */
export function useEscapeLayer(open: boolean, dismiss: () => void, portalContainer?: HTMLElement | null) {
  const origin = useRef<HTMLSpanElement>(null);
  const [layer] = useState<EscapeLayer>(() => ({ order: 0, dismiss: () => {} }));
  const setOrigin = useCallback((node: HTMLSpanElement | null) => {
    origin.current = node;
    unregister(layer);
    if (!node) return;
    layer.dismiss = dismiss;
    if (open) register(layer, portalContainer?.ownerDocument ?? node.ownerDocument);
    else layer.order = 0;
  }, [dismiss, layer, open, portalContainer]);

  const isTopLayer = useCallback((event?: Event) => {
    if (!layer.document) return false;
    const top = escapeLayers.get(layer.document)?.at(-1);
    if (event && top && !interactionLayers.has(event)) interactionLayers.set(event, top);
    // A deferred outside click must retain the owner it had on pointerdown,
    // even if that child has closed by the time Radix delivers the click.
    return (event ? interactionLayers.get(event) : top) === layer;
  }, [layer]);

  function onEscapeKeyDown(event: Pick<KeyboardEvent, "defaultPrevented" | "preventDefault">) {
    if (event.defaultPrevented || !layer.document) return;
    const top = escapeLayers.get(layer.document)?.at(-1);
    if (!top) return;
    // Cancel before notifying a consumer that may synchronously unmount its
    // overlay. One event must never dismiss both the child and its parent.
    event.preventDefault();
    top.dismiss();
  }

  return { origin, setOrigin, onEscapeKeyDown, isTopLayer };
}
