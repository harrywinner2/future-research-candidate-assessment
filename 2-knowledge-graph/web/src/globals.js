// Must be imported FIRST. The ported mock modules reference a global `React`
// (and ReactDOM) and register their components on `window`. We expose the npm
// React here before any of those side-effecting modules evaluate.
import React from 'react'
import * as ReactDOMClient from 'react-dom/client'

window.React = React
window.ReactDOM = ReactDOMClient
