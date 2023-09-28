import React, {Component} from 'react';
import plotly from 'plotly.js/dist/plotly';
import PlotlyEditor from 'react-chart-editor';
import 'react-chart-editor/lib/react-chart-editor.css';
import {produce, setAutoFreeze} from "immer"

const dataSources = {
  col1: [1, 2, 3], // eslint-disable-line no-magic-numbers
  col2: [4, 3, 2], // eslint-disable-line no-magic-numbers
  col3: [17, 13, 9], // eslint-disable-line no-magic-numbers
};

const dataSourceOptions = Object.keys(dataSources).map((name) => ({
  value: name, label: name,
}));

const config = { editable: true };

class App extends Component {
  constructor(props) {
    super(props);
    setAutoFreeze(false);
    this.state = { data: [], layout: {}, frames: [], dataSources };
    setInterval(() => {
      this.setState(({ data }) => {
        const dataSourcesNew = Object.fromEntries(Object.entries(dataSources).map(([key, value]) => [key, value.map(() => Math.random())]));
        const newData = produce(data, draft => {
          function update(obj) {
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
                  if (source in dataSourcesNew) {
                    if (typeof val === "string") {
                      obj[attr] = dataSourcesNew[source];
                    } else {
                      obj[attr][i] = dataSourcesNew[source];
                    }
                  }
                }
              } else if (typeof val === "object") {
                update(obj[key]);
              }
            }
          }

          update(draft);
        });
        return { data: newData, dataSources: dataSourcesNew };
      });
    }, 1000);
  }

  render() {
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
          console.log('onUpdate', { data, layout, frames });
          this.setState({ data, layout, frames });
        }}
        useResizeHandler
        debug
        advancedTraceTypeSelector
      />
    </div>);
  }
}

export default App;
