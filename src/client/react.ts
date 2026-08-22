/**
 * React shim — 提供 React 供 tsx 使用。
 * tsdown 将 react 设为 external，产物以 `require('react')` 解析，
 * 由 DSH client 模块系统的 seed 提供。
 */
import React from 'react'
export default React
