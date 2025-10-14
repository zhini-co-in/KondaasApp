import * as React from 'react';
declare global {
  namespace JSX {
    type Element = React.ReactElement | null;
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
