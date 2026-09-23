import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
// 合并问数模块外壳（可见性切换）：故意不参与 #np-root 作用域化，见文件头注释
import './wenshu-shell.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)