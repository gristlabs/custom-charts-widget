The Advanced Chart custom widget gives you more power and flexibility than Grist’s built-in charts, offering a wide variety of chart types as well as increased control over styling and layout. It’s a version of Plotly’s [Chart Studio](https://chart-studio.plotly.com/), see their [tutorials](https://plotly.com/chart-studio-help/tutorials/) for more detailed help.

In the custom widget configuration, choose “Custom URL” and paste the following URL:

https://gristlabs.github.io/grist-widget/chart/

You’ll need to set the access level to “Full document access”. Don’t worry, the widget only reads data from the selected table, doesn’t send it to any servers, and doesn’t write or otherwise make changes back to your document.

This is what you should see:

![Trace your data](./images/Screenshot%20from%202023-10-06%2013-51-47.png)

Click the big blue “+ Trace” button to get started. This will add a panel like the following:

![trace 0, Type: Scatter](./images/Screenshot%20from%202023-10-06%2013-54-38.png)

Click “Scatter” to choose a different chart type such as Bar or Line. Then click the “Choose data” dropdowns to select the columns you want to plot.

You can add multiple traces to overlay different plots. Try different panels from the sidebar to customize the chart further. For example, go to Style > Axes > Titles to add a label to each axis. See the [chart studio tutorials](https://plotly.com/chart-studio-help/tutorials/) to learn more.

As you customize the widget, remember to regularly click the ‘Save’ button above the widget to keep your configuration.
