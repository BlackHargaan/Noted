import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
afterEach(cleanup);
// jsdom does not implement native modal dialogs.
HTMLDialogElement.prototype.showModal = function() { this.setAttribute('open', ''); };
HTMLDialogElement.prototype.close = function() { this.removeAttribute('open'); };
if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!Range.prototype.getClientRects) Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
if (!Range.prototype.getBoundingClientRect) Range.prototype.getBoundingClientRect = () => ({ x:0,y:0,top:0,left:0,right:0,bottom:0,width:0,height:0,toJSON(){} });
