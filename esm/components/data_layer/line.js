/** @module */
import * as d3 from 'd3';

import BaseDataLayer from './base';
import {merge} from '../../helpers/layouts';
import {STATUSES} from '../constants';
import {applyStyles} from '../../helpers/common';

const default_layout = {
    style: {
        fill: 'none',
        'stroke-width': '2px'
    },
    interpolate: 'curveLinear',
    x_axis: { field: 'x' },
    y_axis: { field: 'y', axis: 1 },
    hitarea_width: 5,
};

/*********************
 * Line Data Layer
 * Implements a standard line plot, representing either a trace or a filled curve.
*/
class Line extends BaseDataLayer {
    constructor(layout) {
        layout = merge(layout, default_layout);
        if (layout.tooltip) {
            throw new Error('The line / filled curve layer does not support tooltips');
        }
        super(...arguments);
    }

    /**
     * Implement the main render function
     */
    render() {
        // Several vars needed to be in scope
        const panel = this.parent;
        const x_field = this.layout.x_axis.field;
        const y_field = this.layout.y_axis.field;

        // Join data to the line selection
        const selection = this.svg.group
            .selectAll('path.lz-data_layer-line')
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append('path')
            .attr('class', 'lz-data_layer-line');

        // Generate the line
        let line;
        const x_scale = panel['x_scale'];
        const y_scale = panel[`y${this.layout.y_axis.axis}_scale`];
        if (this.layout.style.fill && this.layout.style.fill !== 'none') {
            // Filled curve: define the line as a filled boundary
            line = d3.area()
                .x((d) => +x_scale(d[x_field]))
                .y0(+y_scale(0))
                .y1((d) => +y_scale(d[y_field]));
        } else {
            // Basic line
            line = d3.line()
                .x((d) => +x_scale(d[x_field]))
                .y((d) => +y_scale(d[y_field]))
                .curve(d3[this.layout.interpolate]);
        }

        // Apply line and style
        selection
            .attr('d', line);

        applyStyles(selection, this.layout.style);

        // Remove old elements as needed
        selection.exit()
            .remove();

    }

    /**
     * Redefine setElementStatus family of methods as line data layers will only ever have a single path element
     * @param {String} status A member of `LocusZoom.DataLayer.Statuses.adjectives`
     * @param {String|Object} element
     * @param {Boolean} toggle
     * @returns {Line}
     */
    setElementStatus(status, element, toggle) {
        return this.setAllElementStatus(status, toggle);
    }

    setElementStatusByFilters(status, toggle) {
        return this.setAllElementStatus(status, toggle);
    }

    setAllElementStatus(status, toggle) {
        // Sanity check
        if (typeof status == 'undefined' || !STATUSES.adjectives.includes(status)) {
            throw new Error('Invalid status');
        }
        if (typeof this.layer_state.status_flags[status] == 'undefined') {
            return this;
        }
        if (typeof toggle == 'undefined') {
            toggle = true;
        }

        // Update global status flag
        this.global_statuses[status] = toggle;

        // Apply class to path based on global status flags
        let path_class = 'lz-data_layer-line';
        Object.keys(this.global_statuses).forEach((global_status) => {
            if (this.global_statuses[global_status]) {
                path_class += ` lz-data_layer-line-${global_status}`;
            }
        });
        this.path.attr('class', path_class);

        // Trigger layout changed event hook
        this.parent.emit('layout_changed', true);
        return this;
    }
}

const default_orthogonal_layout = {
    style: {
        'stroke': '#D3D3D3',
        'stroke-width': '3px',
        'stroke-dasharray': '10px 10px'
    },
    orientation: 'horizontal',
    x_axis: {
        axis: 1,
        decoupled: true
    },
    y_axis: {
        axis: 1,
        decoupled: true
    },
    tooltip_positioning: 'vertical',
    offset: 0
};


/***************************
 *  Orthogonal Line Data Layer
 *  Implements a horizontal or vertical line given an orientation and an offset in the layout
 *  Does not require a data source
*/
class OrthogonalLine extends BaseDataLayer {
    constructor(layout) {
        layout = merge(layout, default_orthogonal_layout);
        // Require that orientation be "horizontal" or "vertical" only
        if (!['horizontal','vertical'].includes(layout.orientation)) {
            layout.orientation = 'horizontal';
        }
        super(...arguments);

        // Vars for storing the data generated line
        /** @member {Array} */
        this.data = [];
    }

    getElementId(element) {
        // There is only one line per datalayer, so this is sufficient.
        return this.getBaseId();
    }

    /**
     * Implement the main render function
     */
    render() {

        // Several vars needed to be in scope
        const panel = this.parent;
        const x_scale = 'x_scale';
        const y_scale = `y${this.layout.y_axis.axis}_scale`;
        const x_extent = 'x_extent';
        const y_extent = `y${this.layout.y_axis.axis}_extent`;
        const x_range = 'x_range';

        // Generate data using extents depending on orientation
        if (this.layout.orientation === 'horizontal') {
            this.data = [
                { x: panel[x_extent][0], y: this.layout.offset },
                { x: panel[x_extent][1], y: this.layout.offset }
            ];
        } else if (this.layout.orientation === 'vertical') {
            this.data = [
                { x: this.layout.offset, y: panel[y_extent][0] },
                { x: this.layout.offset, y: panel[y_extent][1] }
            ];
        } else {
            throw new Error('Unrecognized vertical line type. Must be "vertical" or "horizontal"');
        }

        // Join data to the line selection
        const selection = this.svg.group
            .selectAll('path.lz-data_layer-line')
            .data([this.data]);

        // Create path element, apply class
        this.path = selection.enter()
            .append('path')
            .attr('class', 'lz-data_layer-line');

        // In some cases, a vertical line may overlay a track that has no inherent y-values (extent)
        //  When that happens, provide a default height based on the current panel dimensions (accounting
        //      for any resizing that happened after the panel was created)
        const default_y = [panel.layout.cliparea.height, 0];

        // Generate the line
        const line = d3.line()
            .x((d, i) => {
                const x = +panel[x_scale](d['x']);
                return isNaN(x) ? panel[x_range][i] : x;
            })
            .y((d, i) => {
                const y = +panel[y_scale](d['y']);
                return isNaN(y) ? default_y[i] : y;
            });

        // Apply line and style
        selection
            .attr('d', line);

        applyStyles(selection, this.layout.style);

        // Remove old elements as needed
        selection
            .exit()
            .remove();

        // Allow the layer to respond to mouseover events and show a tooltip.
        this.applyBehaviors(selection);
    }

    _getTooltipPosition(tooltip) {
        try {
            const coords = d3.mouse(this.svg.container.node());
            const x = coords[0];
            const y = coords[1];
            return { x_min: x - 1, x_max: x + 1, y_min: y - 1, y_max: y + 1 };
        } catch (e) {
            // On redraw, there won't be a mouse event, so skip tooltip repositioning.
            return null;
        }
    }

}


export { Line as line, OrthogonalLine as orthogonal_line };
