import React from "react";
import { createRoot } from "react-dom/client";
import classNames from 'classnames';
import '/src/index.css';

import ThemedApp from "./ThemedApp.tsx";

const cns = classNames;

const domNode = document.getElementById("app")!;
const root = createRoot(domNode);

root.render(
  <React.StrictMode>
    <div className={cns(
      'flex min-h-dvh flex-col bg-light-sds-color-primitive-gray-50',
      'text-light-sds-color-primitive-gray-900 dark:bg-dark-sds-color-primitive-gray-50',
      'dark:text-dark-sds-color-primitive-gray-900',
      'font-sds-body',
      'min-w-[1024px]'
    )}>
      <ThemedApp />
    </div>
  </React.StrictMode>
);
