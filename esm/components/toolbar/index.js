/** @module */
import widgets from '../../registry/widgets';
import * as d3 from 'd3';

/**
 * A Toolbar is an HTML element used for presenting arbitrary user interface widgets. Toolbars are anchored
 *   to either the entire Plot or to individual Panels.
 *
 * Each toolbar is an HTML-based (read: not SVG) collection of widgets used to display information or provide
 *   user interface. Toolbars can exist on entire plots, where their visibility is permanent and vertically adjacent
 *   to the plot, or on individual panels, where their visibility is tied to a behavior (e.g. a mouseover) and is as
 *   an overlay.
 *
 * This class is used internally for rendering, and is not part of the public interface
 * @private
 */
class Toolbar {
    constructor(parent) {
        // parent must be a locuszoom plot or panel
        // if (!(parent instanceof LocusZoom.Plot) && !(parent instanceof LocusZoom.Panel)) {
        //     throw new Error('Unable to create toolbar, parent must be a locuszoom plot or panel');
        // }
        /** @member {Plot|Panel} */
        this.parent = parent;
        /** @member {String} */
        this.id = `${this.parent.getBaseId()}.toolbar`;
        /** @member {('plot'|'panel')} */
        // FIXME: checking constructor name fails, because minified file renames constructor (sigh)
        this.type = this.parent.constructor.name.toLowerCase();
        /** @member {Plot} */
        this.parent_plot = this.type === 'plot' ? this.parent : this.parent.parent;

        /** @member {d3.selection} */
        this.selector = null;
        /** @member {BaseWidget[]} */
        this.widgets = [];
        /**
         * The timer identifier as returned by setTimeout
         * @member {Number}
         */
        this.hide_timeout = null;
        /**
         * Whether to hide the toolbar. Can be overridden by a child widget. Check via `shouldPersist`
         * @protected
         * @member {Boolean}
         */
        this.persist = false;

        // TODO: Return value from constructor function?
        return this.initialize();
    }

    /**
     * Prepare the toolbar for first use: generate all widget instances for this toolbar, based on the provided
     *   layout of the parent. Connects event listeners and shows/hides as appropriate.
     * @returns {Toolbar}
     */
    initialize() {
        // Parse layout to generate widget instances
        // In LZ 0.12, `dashboard.widgets` was renamed to `toolbar.widgets`. Preserve a backwards-compatible alias.
        const options = this.parent.layout.toolbar.widgets || this.parent.layout.toolbar.widgets;
        if (Array.isArray(options)) {
            options.forEach((layout) => {
                try {
                    const widget = widgets.create(layout.type, layout, this);
                    this.widgets.push(widget);
                } catch (e) {
                    console.warn(e);
                }
            });
        }

        // Add mouseover event handlers to show/hide panel toolbar
        if (this.type === 'panel') {
            d3.select(this.parent.parent.svg.node().parentNode).on(`mouseover.${this.id}`, () => {
                clearTimeout(this.hide_timeout);
                if (!this.selector || this.selector.style('visibility') === 'hidden') {
                    this.show();
                }
            });
            d3.select(this.parent.parent.svg.node().parentNode).on(`mouseout.${this.id}`, () => {
                clearTimeout(this.hide_timeout);
                this.hide_timeout = setTimeout(() => {
                    this.hide();
                }, 300);
            });
        }

        return this;
    }

    /**
     * Whether to persist the toolbar. Returns true if at least one widget should persist, or if the panel is engaged
     *   in an active drag event.
     * @returns {boolean}
     */
    shouldPersist() {
        if (this.persist) {
            return true;
        }
        let persist = false;
        // Persist if at least one widget should also persist
        this.widgets.forEach((widget) => {
            persist = persist || widget.shouldPersist();
        });
        // Persist if in a parent drag event
        persist = persist || (this.parent_plot.panel_boundaries.dragging || this.parent_plot.interaction.dragging);
        return !!persist;
    }

    /**
     * Make the toolbar appear. If it doesn't exist yet create it, including creating/positioning all widgets within,
     *   and make sure it is set to be visible.
     */
    show() {
        if (!this.selector) {
            switch (this.type) {
            case 'plot':
                this.selector = d3.select(this.parent.svg.node().parentNode)
                    .insert('div', ':first-child');
                break;
            case 'panel':
                this.selector = d3.select(this.parent.parent.svg.node().parentNode)
                    .insert('div', '.lz-data_layer-tooltip, .lz-toolbar-menu, .lz-curtain').classed('lz-panel-toolbar', true);
                break;
            default:
                throw new Error(`Toolbar cannot be a child of ${this.type}`);
            }

            this.selector
                .classed('lz-toolbar', true)
                .classed(`lz-${this.type}-toolbar`, true)
                .attr('id', this.id);
        }
        this.widgets.forEach((widget) => widget.show());
        this.selector.style('visibility', 'visible');
        return this.update();
    }


    /**
     * Update the toolbar and rerender all child widgets. This can be called whenever plot state changes.
     * @returns {Toolbar}
     */
    update() {
        if (!this.selector) {
            return this;
        }
        this.widgets.forEach((widget) => widget.update());
        return this.position();
    }


    /**
     * Position the toolbar (and child widgets) within the panel
     * @returns {Toolbar}
     */
    position() {
        if (!this.selector) {
            return this;
        }
        // Position the toolbar itself (panel only)
        if (this.type === 'panel') {
            const page_origin = this.parent.getPageOrigin();
            const top = `${(page_origin.y + 3.5).toString()}px`;
            const left = `${page_origin.x.toString()}px`;
            const width = `${(this.parent.layout.width - 4).toString()}px`;
            this.selector
                .style('position', 'absolute')
                .style('top', top)
                .style('left', left)
                .style('width', width);
        }
        // Recursively position widgets
        this.widgets.forEach((widget) => widget.position());
        return this;
    }

    /**
     * Hide the toolbar (make invisible but do not destroy). Will do nothing if `shouldPersist` returns true.
     *
     * @returns {Toolbar}
     */
    hide() {
        if (!this.selector || this.shouldPersist()) {
            return this;
        }
        this.widgets.forEach((widget) => widget.hide());
        this.selector
            .style('visibility', 'hidden');
        return this;
    }

    /**
     * Completely remove toolbar and all child widgets. (may be overridden by persistence settings)
     * @param {Boolean} [force=false] If true, will ignore persistence settings and always destroy the toolbar
     * @returns {Toolbar}
     */
    destroy(force) {
        if (typeof force == 'undefined') {
            force = false;
        }
        if (!this.selector) {
            return this;
        }
        if (this.shouldPersist() && !force) {
            return this;
        }
        this.widgets.forEach((widget) => widget.destroy(true));
        this.widgets = [];
        this.selector.remove();
        this.selector = null;
        return this;
    }
}


export {Toolbar as default};
