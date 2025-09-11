import "./modulepreload-polyfill-DaKOjhqt.js";
class IdetikNavigation {
  navigation_;
  navTitle_;
  toggle_;
  close_;
  examplesList_;
  iframe_;
  examples_ = [];
  constructor() {
    this.navigation_ = document.getElementById("idetik-navigation");
    this.navTitle_ = document.getElementById("nav-title");
    this.toggle_ = document.getElementById("nav-toggle");
    this.close_ = document.getElementById("nav-close");
    this.examplesList_ = document.getElementById("examples-list");
    this.iframe_ = document.getElementById(
      "example-frame"
    );
    this.initializeEventListeners();
    this.loadExamples();
  }
  initializeEventListeners() {
    this.toggle_.addEventListener("click", () => this.openMenu());
    this.close_.addEventListener("click", () => this.closeMenu());
    document.addEventListener("click", (e) => {
      if (!this.navigation_.contains(e.target)) {
        this.closeMenu();
      }
    });
    window.addEventListener("hashchange", () => this.handleRouteChange());
  }
  async loadExamples() {
    try {
      const response = await fetch(`/examples-manifest.json?t=${Date.now()}`);
      const manifest = await response.json();
      this.examples_ = manifest.examples || [];
      this.renderExamples();
      this.handleRouteChange();
    } catch (error) {
      console.error("Failed to load examples manifest:", error);
      this.examplesList_.innerHTML = '<div class="nav-empty">Failed to load examples</div>';
    }
  }
  renderExamples() {
    if (this.examples_.length === 0) {
      this.examplesList_.innerHTML = '<div class="nav-empty">No examples found</div>';
      return;
    }
    this.examplesList_.innerHTML = this.examples_.map(
      (example) => `
        <div class="nav-item" data-path="${example.path}">
          <div class="nav-title">${example.title}</div>
        </div>
      `
    ).join("");
    this.examplesList_.querySelectorAll(".nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        const path = item.dataset.path;
        this.navigateToExample(path);
        this.closeMenu();
      });
    });
  }
  navigateToExample(path) {
    window.location.hash = "#" + path;
  }
  handleRouteChange() {
    const hash = window.location.hash.slice(1);
    if (hash) {
      this.loadExample(hash);
    } else {
      if (this.examples_.length > 0) {
        this.navigateToExample(this.examples_[0].path);
      } else {
        this.iframe_.src = "about:blank";
      }
    }
  }
  loadExample(path) {
    const container = this.iframe_.parentElement;
    const oldIframe = this.iframe_;
    const validExample = this.examples_.find((ex) => ex.path === path);
    const safePath = validExample ? validExample.path : this.examples_[0]?.path || "about:blank";
    const newIframe = document.createElement("iframe");
    newIframe.id = "example-frame";
    newIframe.src = safePath;
    newIframe.style.width = "100%";
    newIframe.style.height = "100%";
    newIframe.style.border = "none";
    newIframe.style.background = "white";
    container.replaceChild(newIframe, oldIframe);
    this.iframe_ = newIframe;
    this.examplesList_.querySelectorAll(".nav-item").forEach((item) => {
      item.classList.toggle(
        "active",
        item.dataset.path === safePath
      );
    });
    if (validExample) {
      document.title = `${validExample.title} - Idetik Examples`;
      this.navTitle_.textContent = document.title;
    }
  }
  openMenu() {
    this.navigation_.classList.add("open");
  }
  closeMenu() {
    this.navigation_.classList.remove("open");
  }
}
function initializeNavigationIfPresent() {
  const navigationElement = document.getElementById("idetik-navigation");
  if (navigationElement) {
    new IdetikNavigation();
  }
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeNavigationIfPresent);
} else {
  initializeNavigationIfPresent();
}
//# sourceMappingURL=main-BgRWBleL.js.map
