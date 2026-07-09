<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  // Add zoom and pan controls to mermaid diagrams
  const addControlsToMermaid = () => {
    const mermaidDivs = document.querySelectorAll(
      ".mermaid-wrapper, pre.mermaid",
    );

    mermaidDivs.forEach((wrapper) => {
      // Skip if controls already added
      if (wrapper.querySelector(".mermaid-controls")) return;

      const svg = wrapper.querySelector("svg");
      if (!svg) return;

      // Make SVG responsive
      svg.style.maxWidth = "100%";
      svg.style.height = "auto";

      // Create controls container
      const controls = document.createElement("div");
      controls.className = "mermaid-controls";
      controls.innerHTML = `
        <button class="mermaid-btn" data-action="zoom-in" title="Zoom In">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
          </svg>
        </button>
        <button class="mermaid-btn" data-action="zoom-out" title="Zoom Out">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 8a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7A.5.5 0 0 1 4 8z"/>
          </svg>
        </button>
        <button class="mermaid-btn" data-action="reset" title="Reset Zoom">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z"/>
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
          </svg>
        </button>
        <button class="mermaid-btn" data-action="fullscreen" title="Toggle Fullscreen">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1a.5.5 0 0 0-.5.5v4a.5.5 0 0 1-1 0v-4A1.5 1.5 0 0 1 1.5 0h4a.5.5 0 0 1 0 1h-4zM10 .5a.5.5 0 0 1 .5-.5h4A1.5 1.5 0 0 1 16 1.5v4a.5.5 0 0 1-1 0v-4a.5.5 0 0 0-.5-.5h-4a.5.5 0 0 1-.5-.5zM.5 10a.5.5 0 0 1 .5.5v4a.5.5 0 0 0 .5.5h4a.5.5 0 0 1 0 1h-4A1.5 1.5 0 0 1 0 14.5v-4a.5.5 0 0 1 .5-.5zm15 0a.5.5 0 0 1 .5.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a.5.5 0 0 1 0-1h4a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 1 .5-.5z"/>
          </svg>
        </button>
      `;

      wrapper.appendChild(controls);

      // Add interactive functionality
      let scale = 1;
      let isDragging = false;
      let startX = 0;
      let startY = 0;
      let translateX = 0;
      let translateY = 0;

      const updateTransform = () => {
        svg.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      };

      // Zoom controls
      controls.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const action = (e.currentTarget as HTMLElement).dataset.action;

          switch (action) {
            case "zoom-in":
              scale = Math.min(scale * 1.2, 3);
              break;
            case "zoom-out":
              scale = Math.max(scale / 1.2, 0.5);
              break;
            case "reset":
              scale = 1;
              translateX = 0;
              translateY = 0;
              break;
            case "fullscreen":
              if (document.fullscreenElement) {
                document.exitFullscreen?.();
              } else {
                wrapper.requestFullscreen?.();
              }
              return;
          }

          updateTransform();
        });
      });

      // Mouse wheel zoom
      wrapper.addEventListener("wheel", (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(Math.max(scale * delta, 0.5), 3);
        updateTransform();
      });

      // Pan on drag
      svg.style.cursor = "grab";

      svg.addEventListener("mousedown", (e: MouseEvent) => {
        isDragging = true;
        svg.style.cursor = "grabbing";
        startX = e.clientX - translateX;
        startY = e.clientY - translateY;
      });

      document.addEventListener("mousemove", (e: MouseEvent) => {
        if (!isDragging) return;
        translateX = e.clientX - startX;
        translateY = e.clientY - startY;
        updateTransform();
      });

      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          svg.style.cursor = "grab";
        }
      });
    });
  };

  // Run after mermaid renders
  setTimeout(addControlsToMermaid, 100);

  // Also run when route changes
  if (globalThis.window !== undefined) {
    globalThis.addEventListener("hashchange", () => {
      setTimeout(addControlsToMermaid, 100);
    });
  }
});
</script>

<template>
  <div></div>
</template>

<style>
.mermaid-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 4px;
  z-index: 10;
  background: var(--vp-c-bg);
  padding: 4px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--vp-c-divider);
}

.mermaid-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.mermaid-btn:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-brand-1);
}

.mermaid-btn:active {
  transform: scale(0.95);
}

.mermaid-wrapper,
pre.mermaid {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  background: var(--vp-c-bg-soft);
}

.mermaid-wrapper:fullscreen,
pre.mermaid:fullscreen {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vp-c-bg);
}

.mermaid-wrapper svg,
pre.mermaid svg {
  transition: transform 0.1s ease;
  transform-origin: center;
}
</style>
