import React, {Component} from 'react';
import plotly from 'plotly.js/dist/plotly';
import PlotlyEditor, {Button} from 'react-chart-editor';
import 'react-chart-editor/lib/react-chart-editor.css';
import {produce, setAutoFreeze} from "immer"
import 'react-chart-editor/lib/react-chart-editor.min.css'
import {CogIcon} from 'plotly-icons';

const config = { displayModeBar: false };

const srcPrefix = "gristsrc:"

function colRefToSrc(colRef) {
  return srcPrefix + colRef;
}

function isGristSrc(src) {
  return typeof src === "string" && src.startsWith(srcPrefix);
}

function fillInData(obj, dataSources, collectedData) {
  for (const key in obj) {
    const val = obj[key];
    if (key === "0" && typeof val !== "object") {
      return;
    }
    if (key.endsWith("src") && val) {
      const attr = key.slice(0, -3);
      const sources = typeof val === "string" ? [val] : val;
      if (!Array.isArray(sources) || !sources.length || !isGristSrc(sources[0])) {
        continue;
      }
      const newSources = [];
      let values = [];
      for (const source of sources) {
        if (source in dataSources) {
          newSources.push(source);
          values.push([...dataSources[source]]);
        }
      }
      obj[key] = newSources.length === 1 ? newSources[0] : newSources;
      if (values.length === 1) {
        function setter(v) {
          obj[attr] = v;
        }

        values = values[0];
        collectedData.push({ values, obj, attr, setter });
      } else {
        values.forEach((column, i) => {
          function setter(v) {
            obj[attr][i] = v;
          }

          collectedData.push({ values: column, obj, attr, setter });
        });
      }
      obj[attr] = values;
    } else if (typeof val === "object") {
      fillInData(obj[key], dataSources, collectedData);
    }
  }
}

function produceFilledInData(obj, dataSources) {
  if (!obj) {
    return [];
  }
  return produce(obj, draft => {
    for (const trace of draft) {
      const collectedData = [];
      fillInData(trace, dataSources, collectedData);
      flattenLists(collectedData);
      for (const { values, setter } of collectedData) {
        setter(values);
      }
    }
  });
}

function flattenLists(collectedData) {
  for (const col of collectedData) {
    if (!col.values.some(Array.isArray)) {
      continue;
    }
    for (const col of collectedData) {
      col.newValues = [];
    }
    for (let valueIndex = 0; valueIndex < col.values.length; valueIndex++) {
      const value = col.values[valueIndex];
      const valueArr = Array.isArray(value) ? value : [value];
      col.newValues.push(...valueArr);
      for (const otherCol of collectedData) {
        if (otherCol === col) {
          continue;
        }
        otherCol.newValues.push(...new Array(valueArr.length).fill(otherCol.values[valueIndex]));
      }
    }
    for (const col of collectedData) {
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
    setAutoFreeze(false);
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
        // Make a copy of data to tell plotly to refresh so that it fits with the expanded sidebar.
        data: [...state.data],
      };
    });
  }

  render() {
    return (<div className="app">
      <PlotlyEditor
        hideControls={this.state.hideControls}
        data={this.state.data}
        layout={this.state.layout}
        config={config}
        frames={this.state.frames}
        dataSources={this.state.dataSources}
        dataSourceOptions={this.state.dataSourceOptions}
        plotly={plotly}
        onUpdate={(data, layout, frames) => {
          console.log("onUpdate", { data, layout, frames });
          for (const [key, value] of Object.entries(layout)) {
            if (/^[xyz]axis\d*$/.test(key) && !("automargin" in value)) {
              value.automargin = true;
              layout = { ...layout };
            }
          }
          this.setState({ data, layout, frames });
          const emptyDataSources = Object.fromEntries(this.state.dataSourceOptions.map(({ value }) => [value, []]));
          data = produceFilledInData(data, emptyDataSources);
          grist.setOption('state', { data, layout, frames });
        }}
        useResizeHandler
        advancedTraceTypeSelector
      />
      {this.state.data.length > 0 && (
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

export default App;
