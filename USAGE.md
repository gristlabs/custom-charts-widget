The Advanced Chart custom widget gives you more power and flexibility than Grist’s built-in charts, offering a wide variety of chart types as well as increased control over styling and layout. It’s a version of Plotly’s [Chart Studio](https://chart-studio.plotly.com/), see their [tutorials](https://plotly.com/chart-studio-help/tutorials/) for more detailed help.

This widget is still very new and under active development, so some things might not work as expected, but you can still start using it and unlock many new possibilities.

In the custom widget configuration, choose “Custom URL” and paste the following URL:

https://gristlabs.github.io/custom-charts-widget/

You’ll need to set the access level to “Full document access”. Don’t worry, the widget only reads data from the selected table, doesn’t send it to any servers, and doesn’t write or otherwise make changes back to your document.

This is what you should see:

![Trace your data](./images/Screenshot%20from%202023-10-06%2013-51-47.png)

Click the big blue “+ Trace” button to get started. This will add a panel like the following:

![trace 0, Type: Scatter](./images/Screenshot%20from%202023-10-06%2013-54-38.png)

Click “Scatter” to choose a different chart type such as Bar or Line. Then click the “Choose data” dropdowns to select the columns you want to plot. Currently only the following column types are supported:

* Numeric
* Integer
* Text
* Choice
* Toggle

If you have a column of another type that you need to plot, we’re working on it, but in the meantime here’s what you can do:

* Any: set a specific type for that column, or for a new column with a formula that simply copies the value, e.g. `$my_column`
* Choice List or Reference List: make a summary table grouping by that column, to ‘flatten’ the lists into individual choices/references
* Reference: add a new column with a formula like `$my_reference_column.my_visible_column` and set a specific column type.
* Date or DateTime: add a new column with a formula like `$my_date_column.strftime('%Y-%m-%d')` (see https://www.strfti.me/ for other formatting options) and set the column type to Text.

You can add multiple traces to overlay different plots. Try different panels from the sidebar to customize the chart further. For example, go to Style > Axes > Titles to add a label to each axis. See the [chart studio tutorials](https://plotly.com/chart-studio-help/tutorials/) to learn more.

As you customize the widget, remember to regularly click the ‘Save’ button above the widget to keep your configuration.
