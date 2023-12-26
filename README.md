# Advanced Chart Grist Custom Widget

See [USAGE.md](./USAGE.md) for instructions on how to use this widget in Grist. This README is for developers.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Scripts

- Run `npm install` to get started.
- Run `npm start` to start the development server, and open [http://localhost:3000](http://localhost:3000) to view it in
  the browser.
- Run `npm run deploy` to deploy to GitHub Pages. This will build a production bundle and push it to the `gh-pages` branch, and it will be served at https://gristlabs.github.io/custom-charts-widget/. This won't affect Grist users, see below for more details.

## Deployment as submodule in grist-widget

In the [grist-widget](https://github.com/gristlabs/grist-widget) repo, the `chart` folder is a git submodule pointing at a commit in the `gh-pages` branch of this repo. To fully deploy changes here to production for use in Grist, you need to:

1. Commit and push changes to this repo. It doesn't have to be in the main branch, but an actual commit is important for reference.
2. Run `npm run deploy` to build and push to the `gh-pages` branch. The commit message will contain the commit hash of the commit in step 1. You can use https://gristlabs.github.io/custom-charts-widget/ to test the changes in a Grist doc.
3. In the `grist-widget` repo, run `git submodule update --remote --init` to update the submodule to the latest commit in the `gh-pages` branch. Commit this update, push, and make a PR. The deploy preview URL can be used to test the changes.
4. Merge the `grist-widget` PR. This will trigger a deploy to production.

## Code overview

`public/index.html` is the template for the final `index.html`. Webpack inserts the built JavaScript here. This is also
where `grist-plugin-api.js` is loaded.

`src/index.js` is where all the logic is. Here's how it works:

1. The `PlotlyEditor` component provided by `react-chart-editor` is where the user does all the configuration. When the user makes a change, this calls `onUpdate` with the new plotly configuration, which in particular includes the `data` array (traces) and `layout` object.
2. Data is received via `grist.onRecords` and used to produce two values which get passed to `PlotlyEditor`:
    - `dataSourceOptions`: an array of `{value, label}` objects indicating columns of the selected table that the user can choose from dropdowns (e.g. in the Traces panel) to use in the chart. The `value` has the format `gristsrc:${colRef}`.
    - `dataSources`: an object mapping the `value`s of `dataSourceOptions` to arrays of column values.
3. When a user selects a column from a dropdown, two things get inserted into an object somewhere in the `data` array:
    - The array of column values, i.e. a value from `dataSources`. The corresponding inserted key varies (e.g. `x` or `y`), in the code it's generally referred to as `attr`.
    - The 'source' of the data. The object key is of the form `${attr}src` and the value is a `value` from `dataSourceOptions`, i.e. a string of the form `gristsrc:${colRef}`.
  
    When multiple columns are selected in a dropdown, both values above will be wrapped in an array.

    So overall the react state may include something like this:
```
{
  data: [
    {
      type: 'scatter',
      x: [1, 2, 3, ...],
      xsrc: 'gristsrc:11',
      y: [
        [4, 5, 6, ...],
        [7, 8, 9, ...],
      ],
      ysrc: [
        'gristsrc:12',
        'gristsrc:13',
      ],
      ...
    }
  ],
  dataSources: {
    'gristsrc:11': [1, 2, 3, ...],
    'gristsrc:12': [4, 5, 6, ...],
    'gristsrc:13': [7, 8, 9, ...],
    ...
  },
  dataSourceOptions: [
    {value: 'gristsrc:11', label: 'Column A'},
    {value: 'gristsrc:12', label: 'Column B''},
    {value: 'gristsrc:13', label: 'Column C''},
    ...
  ],
}
```

4. When the data is updated via `onRecords`, we can update `dataSources`, but this *doesn't* automatically update `data`. So we recursively walk through `data` looking for keys ending in `src` with values starting with `gristsrc:`. See the `fillInData` function.
5. The corresponding arrays of column values are gathered into an array `columns` on which we can perform data transformations such as flattening lists. We can't do this directly with the data received in `onRecords` because the transformations depend on the user's selections. The transformed arrays are then put back into the place we found them in `data`.
6. The same recursive function is used to produce a copy of `data` where the column values are replaced by empty arrays. This is saved in the widget options along with `layout`.
