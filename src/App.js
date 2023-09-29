import React, {Component} from 'react';
import plotly from 'plotly.js/dist/plotly';
import PlotlyEditor from 'react-chart-editor';
import 'react-chart-editor/lib/react-chart-editor.css';
import {produce, setAutoFreeze} from "immer"

const config = { editable: true };

function fillInData(obj, dataSources) {
  for (const key in obj) {
    const val = obj[key];
    if (key === "0" && typeof val !== "object") {
      return;
    }
    if (key.endsWith("src")) {
      const attr = key.slice(0, -3);
      const sources = typeof val === "string" ? [val] : val;
      for (const i in sources) {
        const source = sources[i];
        if (source in dataSources) {
          if (typeof val === "string") {
            obj[attr] = dataSources[source];
          } else {
            obj[attr][i] = dataSources[source];
          }
        }
      }
    } else if (typeof val === "object") {
      fillInData(obj[key], dataSources);
    }
  }
}

const { grist } = window;

class App extends Component {
  constructor(props) {
    super(props);
    setAutoFreeze(false);
    this.state = { data: [], layout: {}, frames: [], dataSources: {} };

    const onGristUpdate = async () => {
      const dataSources = await grist.fetchSelectedTable();
      const state = await grist.getOption('state');
      const data = state?.data ? produce(state.data, draft => {
        fillInData(draft, dataSources);
      }) : [];
      this.setState({ ...state, data, dataSources });
    };
    grist.onRecords(onGristUpdate);
    grist.onOptions(onGristUpdate);
    grist.ready();

  }

  render() {
    const dataSourceOptions = Object.keys(this.state.dataSources).map((name) => ({
      value: name, label: name,
    }));
    return (<div className="app">
      <PlotlyEditor
        data={this.state.data}
        layout={this.state.layout}
        config={config}
        frames={this.state.frames}
        dataSources={this.state.dataSources}
        dataSourceOptions={dataSourceOptions}
        plotly={plotly}
        onUpdate={(data, layout, frames) => {
          this.setState({ data, layout, frames });
          const emptyDataSources = Object.fromEntries(dataSourceOptions.map(({value}) => [value, []]));
          data = produce(data, draft => {
            fillInData(draft, emptyDataSources);
          });
          grist.setOption('state', { data, layout, frames });
        }}
        useResizeHandler
        debug
        advancedTraceTypeSelector
      />
    </div>);
  }
}

export default App;
