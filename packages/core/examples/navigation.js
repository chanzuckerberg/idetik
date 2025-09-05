/**
 * Navigation widget for Idetik examples
 * Provides a collapsible menu to navigate between examples
 */

class ExamplesNavigation {
  constructor() {
    this.manifest = null;
    this.isOpen = false;
    this.currentPath = window.location.pathname;

    this.init();
  }

  async init() {
    await this.loadManifest();
    this.createNavigation();
    this.attachEventListeners();
  }

  async loadManifest() {
    try {
      const response = await fetch('/examples-manifest.json');
      if (response.ok) {
        this.manifest = await response.json();
      } else {
        console.warn('Could not load examples manifest');
        this.manifest = { examples: [] };
      }
    } catch (error) {
      console.warn('Error loading examples manifest:', error);
      this.manifest = { examples: [] };
    }
  }

  createNavigation() {
    // Get current example title
    const currentExample = this.getCurrentExample();
    const currentTitle = currentExample ? currentExample.title : 'Unknown Example';
    
    // Create navigation container
    const nav = document.createElement('div');
    nav.id = 'idetik-navigation';
    nav.innerHTML = `
      <div class="nav-header-bar">
        <div class="nav-header-title">Idetik Examples: ${currentTitle}</div>
        <button class="nav-toggle" title="Select Example">
          Select Example
        </button>
      </div>
      <div class="nav-menu">
        <div class="nav-content">
          <div class="nav-list">
            ${this.renderExamplesList()}
          </div>
        </div>
      </div>
    `;

    // Insert at the very beginning of body
    document.body.insertBefore(nav, document.body.firstChild);
  }
  
  getCurrentExample() {
    if (!this.manifest || !this.manifest.examples) return null;
    
    return this.manifest.examples.find(example => 
      this.currentPath.includes(example.path.slice(1, -1))
    );
  }

  renderExamplesList() {
    if (!this.manifest || !this.manifest.examples.length) {
      return '<div class="nav-empty">No examples found</div>';
    }

    return this.manifest.examples.map(example => {
      const isActive = this.currentPath.includes(example.path.slice(1, -1));
      return `
        <a href="${example.path}" class="nav-item ${isActive ? 'active' : ''}">
          <span class="nav-title">${example.title}</span>
        </a>
      `;
    }).join('');
  }

  attachEventListeners() {
    const toggle = document.querySelector('#idetik-navigation .nav-toggle');
    const menu = document.querySelector('#idetik-navigation .nav-menu');
    const nav = document.querySelector('#idetik-navigation');

    console.log('Attaching listeners:', { toggle, menu, nav });

    if (toggle && menu) {
      toggle.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Toggle clicked, current isOpen:', this.isOpen);
        this.toggleMenu();
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (this.isOpen && !nav.contains(e.target)) {
          this.closeMenu();
        }
      });

      // Close menu on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeMenu();
        }
      });
    } else {
      console.error('Could not find toggle or menu elements');
    }
  }

  toggleMenu() {
    console.log('toggleMenu called, isOpen:', this.isOpen);
    if (this.isOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  openMenu() {
    console.log('Opening menu');
    const nav = document.querySelector('#idetik-navigation');
    if (nav) {
      nav.classList.add('open');
      this.isOpen = true;
      console.log('Menu opened, nav classes:', nav.className);
    }
  }

  closeMenu() {
    console.log('Closing menu');
    const nav = document.querySelector('#idetik-navigation');
    if (nav) {
      nav.classList.remove('open');
      this.isOpen = false;
      console.log('Menu closed, nav classes:', nav.className);
    }
  }
}

// Initialize navigation when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new ExamplesNavigation());
} else {
  new ExamplesNavigation();
}
