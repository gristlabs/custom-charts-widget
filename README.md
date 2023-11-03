# Advanced Chart Grist Custom Widget

See [USAGE.md](./USAGE.md) for instructions on how to use this widget in Grist. This README is for developers.

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Scripts

- Run `npm install` to get started.
- Run `npm start` to start the development server, and open [http://localhost:3000](http://localhost:3000) to view it in
  the browser.
- Run `npm run deploy` to deploy to GitHub Pages. This will build a production bundle and push it to the `gh-pages` branch, and it will be served at https://gristlabs.github.io/custom-charts-widget/.

## Code overview

`public/index.html` is the template for the final `index.html`. Webpack inserts the built JavaScript here. This is also
where `grist-plugin-api.js` is loaded.

`src/index.js` is where all the logic is.
