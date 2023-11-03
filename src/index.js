import React, {Component} from 'react';
import plotly from 'plotly.js/dist/plotly';
import PlotlyEditor, {Button} from 'react-chart-editor';
import 'react-chart-editor/lib/react-chart-editor.css';
import {produce, setAutoFreeze} from "immer"
import 'react-chart-editor/lib/react-chart-editor.min.css'
import {CogIcon} from 'plotly-icons';
import ReactDOM from 'react-dom/client';
import './index.css';

/**
 * Strings of the form `gristsrc:${colRef}` represent Grist table columns.
 * The colRef is the numeric row ID of the metadata record.
 * It's used instead of `colId` because it's stable across renames.
 * The strings appear in 3 places as described in the README:
 * 1. As the values of various `${attr}src` properties in the `data` array produced by Plotly.
 *    The `gristsrc:` prefix makes it easy to identify these values, which is essential.
 *    (although I don't know if other values could actually end up there)
 * 2. As the `value` properties of the `dataSourceOptions` array.
 * 3. As the keys of the `dataSources` object.
 */
const srcPrefix = "gristsrc:"

function colRefToSrc(colRef) {
  return srcPrefix + colRef;
}

function isGristSrc(src) {
  return typeof src === "string" && src.startsWith(srcPrefix);
}

/**
 * Recursively walk through `obj` looking for `gristsrc:` strings.
 * For each one, look up the string in `dataSources` to get the array of column values.
 * Push an object to `columns` containing the array of `values`, a function `setter`
 * to set new `values` back into `obj`, and other possible useful context.
 */
function fillInData(obj, dataSources, columns) {
  for (const key in obj) {
    const val = obj[key];
    if (key === "0" && typeof val !== "object") {
      // This is an optimisation to avoid long loops through arrays of column values.
      // We can't check if `obj` is an array because it's a proxy produced by immer.
      return;
    }
    if (key.endsWith("src") && val) {
      // We might have a single string or an array of strings.
      const sources = typeof val === "string" ? [val] : val;
      if (!Array.isArray(sources) || !sources.length || !isGristSrc(sources[0])) {
        continue;
      }
      // Replace the source(s) with a new array of sources that are actually present,
      // i.e. this is where columns being deleted from the Grist table is handled.
      // Also collect the corresponding arrays of column values.
      const newSources = [];
      let values = [];
      for (const source of sources) {
        if (source in dataSources) {
          newSources.push(source);
          values.push([...dataSources[source]]);
        }
      }
      obj[key] = newSources.length === 1 ? newSources[0] : newSources;
      const attr = key.slice(0, -3);
      if (values.length === 1) {
        function setter(v) {
          obj[attr] = v;
        }

        values = values[0];
        columns.push({ values, obj, attr, setter });
      } else {
        values.forEach((column, i) => {
          function setter(v) {
            obj[attr][i] = v;
          }

          columns.push({ values: column, obj, attr, setter });
        });
      }
      obj[attr] = values;  // this is actually redundant and could maybe be removed
    } else if (typeof val === "object") {
      fillInData(obj[key], dataSources, columns);
    }
  }
}

/**
 * Return a copy of the `data` array with arrays of column values filled in
 * using values derived from `dataSources`.
 * See the README and `fillInData` for details.
 */
function produceFilledInData(data, dataSources) {
  if (!data) {
    return [];
  }
  // In React, state isn't *supposed* to be mutated directly.
  // immer's produce function makes it easy to produce a copy without mutation.
  // But this might not actually matter because react-chart-editor *does* mutate the state:
  // https://github.com/plotly/react-chart-editor/issues/356
  // Still, this seems safer.
  return produce(data, draft => {
    for (const trace of draft) {
      const columns = [];
      fillInData(trace, dataSources, columns);

      // This is where other kinds of data transformations could be added.
      flattenLists(columns);

      for (const { values, setter } of columns) {
        setter(values);
      }
    }
  });
}

// This is needed to avoid errors from immer when react-chart-editor mutates the state.
setAutoFreeze(false);

function flattenLists(columns) {
  for (const col of columns) {
    if (!col.values.some(Array.isArray)) {
      continue;
    }
    for (const col of columns) {
      col.newValues = [];
    }
    for (let valueIndex = 0; valueIndex < col.values.length; valueIndex++) {
      const value = col.values[valueIndex];
      const valueArr = Array.isArray(value) ? value : [value];
      col.newValues.push(...valueArr);
      for (const otherCol of columns) {
        if (otherCol === col) {
          continue;
        }
        otherCol.newValues.push(...new Array(valueArr.length).fill(otherCol.values[valueIndex]));
      }
    }
    for (const col of columns) {
      col.values = col.newValues;
    }
  }
}

// Whether a column is internal and should be hidden.
export function isHiddenCol(colId) {
  return colId.startsWith('gristHelper_') || colId === 'manualSort';
}

const { grist } = window;

async function getColumns() {
  // It'd be nice if most of this logic was handled by the plugin API.
  // Avoiding the server requests from fetchTable might be a noticeable speedup.
  const tableId = await grist.selectedTable.getTableId();
  const tables = await grist.docApi.fetchTable('_grist_Tables');
  const columns = await grist.docApi.fetchTable('_grist_Tables_column');
  const tableRef = tables.id[tables.tableId.indexOf(tableId)];
  const columnRecords = columns.id.map((_id, i) =>
    Object.fromEntries(Object.keys(columns).map(key => [key, columns[key][i]]))
  );
  return columnRecords.filter(
    col => col.parentId === tableRef
      && !isHiddenCol(col.colId)
      && col.type !== "Attachments"
  );
}

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      data: [],
      layout: {
        margin: {
          l: 50,
          r: 50,
          b: 40,  // Space below chart which includes x-axis labels
          t: 30,  // Space above the chart (doesn't include any text)
          pad: 4
        },
      },
      frames: [],
      dataSources: {},
      dataSourceOptions: [],
      hideControls: true,
    };

    const onGristUpdate = async (tableData) => {
      const columns = await getColumns();
      const colIdToSrc = Object.fromEntries(columns.map(col => [col.colId, colRefToSrc(col.id)]));
      const dataSources = Object.fromEntries(Object.entries(tableData).map(
        ([colId, values]) => [colIdToSrc[colId], values.map(v => v === '' || v == null ? '[Blank]' : v)]
      ));
      const dataSourceOptions = columns.map(col => ({
        value: colRefToSrc(col.id),
        label: col.label
      })).filter(col => col.value in dataSources);

      const state = await grist.getOption('state');
      const data = produceFilledInData(state?.data, dataSources);
      this.setState({ ...state, data, dataSources, dataSourceOptions });
      if (!data.length) {
        this.setState({ hideControls: false });
      }
    };
    const dataOptions = {format: 'columns', includeColumns: 'normal'};
    try {
      grist.onRecords(onGristUpdate, dataOptions);
    } catch (e) {
      // Happens if we don't have full access.
      console.warn(e);
    }
    grist.onOptions(async () => {
      const tableData = await grist.fetchSelectedTable(dataOptions);
      await onGristUpdate(tableData);
    });
    grist.ready({
      requiredAccess: 'full',
      onEditOptions: () => this.setHideControls(!this.state.hideControls),
    });
  }

  setHideControls(hideControls) {
    this.setState((state) => {
      if (!state.data.length) {
        return;
      }
      return {
        hideControls,
        // Make a copy of data to tell plotly to refresh so that it resizes
        data: [...state.data],
      };
    });
    // Refresh again shortly after, the first time sometimes isn't quite right.
    setTimeout(() => {
      this.setState(state => ({
        data: [...state.data],
      }))
    }, 20);
  }

  render() {
    return (<div className="app">
      <PlotlyEditor
        hideControls={this.state.hideControls}
        data={this.state.data}
        layout={this.state.layout}
        config={{ displayModeBar: false }}
        frames={this.state.frames}
        dataSources={this.state.dataSources}
        dataSourceOptions={this.state.dataSourceOptions}
        plotly={plotly}
        onUpdate={(data, layout, frames) => {
          // console.log("onUpdate", { data, layout, frames });

          // Set automargin on all axes by default, but users can override this.
          for (const [key, value] of Object.entries(layout)) {
            if (/^[xyz]axis\d*$/.test(key) && !("automargin" in value)) {
              value.automargin = true;
              // Ensure the plotly notices the change in state.
              layout = { ...layout };
            }
          }

          // Save the configuration minus the data as a widget option.
          const emptyDataSources = Object.fromEntries(this.state.dataSourceOptions.map(({ value }) => [value, []]));
          data = produceFilledInData(data, emptyDataSources);
          // This triggers grist.onOptions above, ultimately calling produceFilledInData with the real data.
          grist.setOption('state', { data, layout, frames });
        }}
        useResizeHandler
        advancedTraceTypeSelector
      />
      {
        // Always show the controls when there are no traces yet.
        this.state.data.length > 0 && (
        !this.state.hideControls ?
          <div className="editor_controls plotly-editor--theme-provider">
            <Button
              className="controls-button"
              variant="primary"
              onClick={() => this.setHideControls(true)}
              style={{
                height: 'auto',
                width: 'calc(var(--sidebar-width) - 10px)',
              }}
            >
              Hide Controls
            </Button>
          </div>
          :
          <CogIcon
            className="controls-button show-controls-icon-button"
            onClick={() => this.setHideControls(false)}
          />
      )
      }
    </div>);
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <App/>
);
