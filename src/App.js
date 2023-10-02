import React, {Component} from 'react';
import plotly from 'plotly.js/dist/plotly';
import PlotlyEditor, {Button} from 'react-chart-editor';
import 'react-chart-editor/lib/react-chart-editor.css';
import {produce, setAutoFreeze} from "immer"
import 'react-chart-editor/lib/react-chart-editor.min.css'

const config = { editable: true };

const srcPrefix = "gristsrc:"

function colRefToSrc(colRef) {
  return srcPrefix + colRef;
}

function isGristSrc(src) {
  return src.startsWith(srcPrefix);
}

function fillInData(obj, dataSources) {
  for (const key in obj) {
    const val = obj[key];
    if (key === "0" && typeof val !== "object") {
      return;
    }
    if (key.endsWith("src")) {
      const attr = key.slice(0, -3);
      const sources = typeof val === "string" ? [val] : val;
      if (!sources.length || !isGristSrc(sources[0])) {
        continue;
      }
      const newSources = [];
      const values = [];
      for (const source of sources) {
        if (source in dataSources) {
          newSources.push(source);
          values.push(dataSources[source]);
        }
      }
      obj[key] = newSources.length === 1 ? newSources[0] : newSources;
      obj[attr] = values.length === 1 ? values[0] : values;
    } else if (typeof val === "object") {
      fillInData(obj[key], dataSources);
    }
  }
}

function produceFilledInData(obj, dataSources) {
  if (!obj) {
    return [];
  }
  return produce(obj, draft => {
    fillInData(draft, dataSources);
  });
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
  return columnRecords.filter(col => col.parentId === tableRef);
}

class App extends Component {
  constructor(props) {
    super(props);
    setAutoFreeze(false);
    this.state = {
      data: [],
      layout: {},
      frames: [],
      dataSources: {},
      dataSourceOptions: [],
      hideControls: true,
    };

    const onGristUpdate = async () => {
      const columns = await getColumns();
      const colIdToSrc = Object.fromEntries(columns.map(col => [col.colId, colRefToSrc(col.id)]));
      const tableData = await grist.fetchSelectedTable();
      const dataSources = Object.fromEntries(Object.entries(tableData).map(
        ([colId, values]) => [colIdToSrc[colId], values]
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
    grist.onRecords(onGristUpdate);
    grist.onOptions(onGristUpdate);
    grist.ready({
      requiredAccess: 'full',
      onEditOptions: () => this.setHideControls(false),
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
          this.setState({ data, layout, frames });
          const emptyDataSources = Object.fromEntries(this.state.dataSourceOptions.map(({ value }) => [value, []]));
          data = produceFilledInData(data, emptyDataSources);
          grist.setOption('state', { data, layout, frames });
        }}
        useResizeHandler
        advancedTraceTypeSelector
      />
      {
        !this.state.hideControls && this.state.data.length > 0 &&
        <div className="editor_controls plotly-editor--theme-provider">
          <Button
            variant="primary"
            onClick={() => this.setHideControls(true)}
            style={{
              position: 'fixed',
              bottom: '5px',
              left: '5px',
              height: 'auto',
              width: 'calc(var(--sidebar-width) - 10px)',
            }}
          >
            Hide Controls
          </Button>
        </div>
      }
    </div>);
  }
}

export default App;
