import DataSources from '../../../esm/data';
import * as d3 from 'd3';
import {populate} from '../../../esm/helpers/display';
import {assert} from 'chai';


describe('Toolbar widgets', function () {
    describe('Filter fields Widget', function () {
        beforeEach(function() {
            const datasources = new DataSources()
                .add('d', ['StaticJSON', [{ id: 1, a: 12 }]]);
            const layout = {
                panels: [{
                    id: 'p',
                    toolbar: {
                        widgets: [
                            {
                                type: 'filter_field',
                                position: 'right',
                                layer_name: 'd',
                                field: 'd:a',
                                field_display_html: 'Some Name',
                                operator: '!=',
                                data_type: 'number',
                            },
                        ],
                    },
                    data_layers: [
                        {
                            id: 'd',
                            fields: ['d:id', 'd:a'],
                            id_field: 'd:id',
                            type: 'scatter',
                        },
                    ],
                }],
            };
            d3.select('body').append('div').attr('id', 'plot');
            this.plot = populate('#plot', datasources, layout);
            this.data_layer = this.plot.panels['p'].data_layers['d'];
            this.widget = this.data_layer.parent.toolbar.widgets[0];
        });
        afterEach(function() {
            d3.select('#plot').remove();
            this.plot = null;
        });

        it('creates a filter if none is present in config', function() {
            assert.equal(this.data_layer.layout.filters, null, 'No filters at start');

            const target = this.widget._getTarget();
            assert.deepEqual(target, {field: 'd:a', operator: '!=', value: null}, 'Auto-create blank filter');
        });

        it('updates an existing filter if already present', function() {
            this.data_layer.layout.filters = [{field: 'd:a', operator: '!=', value: 1}];

            this.widget._setFilter(5);
            const target = this.widget._getTarget();
            assert.equal(this.data_layer.layout.filters.length, 1, 'No second filter created');
            assert.deepEqual(target, {field: 'd:a', operator: '!=', value: 5}, 'Updates filter with new value');
        });

        it('finds a specific filter (by id field) when more than one with same operation is used', function() {
            this.widget._filter_id = 'target';
            this.data_layer.layout.filters = [
                {field: 'd:a', operator: '!=', value: null},
                {field: 'd:a', operator: '!=', value: 'squid', id: 'target'},
                {field: 'd:a', operator: '!=', value: 'cephalopod', id: 'detroit'},
            ];

            this.widget._setFilter('al');
            // assert.equal(this.data_layer.layout.filters.length, 3, '3 filters at end');
            assert.deepEqual(
                this.data_layer.layout.filters,
                [
                    {field: 'd:a', operator: '!=', value: null},
                    {field: 'd:a', operator: '!=', value: 'al', id: 'target'},
                    {field: 'd:a', operator: '!=', value: 'cephalopod', id: 'detroit'},
                ], 'Updates filter with new value');
        });

        it('validates values and coerces types', function() {
            const scenarios = [
                ['0', 0],
                ['', null],
                ['notanumber', null],
            ];
            // This test requires the widget actually be rendered
            this.widget.parent.show();
            this.widget.update();
            scenarios.forEach(([input, output]) => {
                this.widget._value_selector.property('value', input);
                assert.equal(
                    this.widget._getValue(),
                    output,
                    `Number conversion should convert input ${input} to output ${output}`
                );
            });
        });

        it('clears the filter if no valid option is provided', function() {
            this.widget.parent.show();
            this.widget.update();
            this.widget._setFilter(12);
            assert.equal(this.data_layer.layout.filters.length, 1, 'Filter has been created');

            this.widget._setFilter(null);
            assert.equal(this.data_layer.layout.filters.length, 0, 'Filter has been removed');
        });
    });
});
