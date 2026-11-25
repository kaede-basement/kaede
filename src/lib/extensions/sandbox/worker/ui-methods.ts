import type { Factory } from "./ui-protocol.ts";

export const Methods = {
  "SafeElement": "setText getText setClass getClass setId getId setTitle " +
    "setRole setTabIndex setHidden setLang setDir setSpellcheck " +
    "setData getData setAria getAria onClick onDblClick " +
    "onMouseDown onMouseUp onMouseEnter onMouseLeave onMouseMove " +
    "onPointerDown onPointerUp onPointerMove onContextMenu " +
    "onKeyDown onKeyUp onFocus onBlur onTouchStart onTouchEnd " +
    "onTouchMove onScroll",
  "SafeInputElement": "setType setValue getValue setPlaceholder setDisabled " +
    "setReadonly setRequired setChecked getChecked setMin setMax " +
    "setStep setMinLength setMaxLength setPattern setAutocomplete " +
    "setAutofocus setName setInputMode setEnterKeyHint onChange " +
    "onInput",
  "SafeTextareaElement": "setValue getValue setPlaceholder setDisabled setReadonly " +
    "setRequired setMinLength setMaxLength setRows setCols " +
    "setWrap setName setAutocomplete onChange onInput",
  "SafeSelectElement": "setValue getValue setDisabled setRequired setMultiple " +
    "setName onChange",
  "SafeOptionElement"  : "setValue setSelected setDisabled setLabel",
  "SafeButtonElement"  : "setType setDisabled setName setValue",
  "SafeLabelElement"   : "setFor",
  "SafeFieldsetElement": "setDisabled",
  "SafeImageElement"   : "setSrc setAlt setWidth setHeight setLoading",
  "SafeAnchorElement"  : "setHref",
  "SafeVideoElement"   : "setSrc setWidth setHeight setControls setAutoplay setLoop " +
    "setMuted setPoster",
  "SafeAudioElement"          : "setSrc setControls setAutoplay setLoop setMuted",
  "SafeSourceElement"         : "setSrc setType",
  "SafeCanvasElement"         : "setWidth setHeight",
  "SafeTableCellElement"      : "setColspan setRowspan setScope setHeaders",
  "SafeDetailsElement"        : "setOpen",
  "SafeDialogElement"         : "setOpen",
  "SafeProgressElement"       : "setValue setMax",
  "SafeMeterElement"          : "setValue setMin setMax",
  "SafeListElement"           : "createItem",
  "SafeDescriptionListElement": "createTerm createDescription",
  "SafeStyleSheet"            : "getCSS setCSS",
  "SafeTextNode"              : "getText setText",
} as const;

export const Factories = {
  "createDiv"        : "SafeElement",
  "createSpan"       : "SafeElement",
  "createSection"    : "SafeElement",
  "createArticle"    : "SafeElement",
  "createNav"        : "SafeElement",
  "createHeader"     : "SafeElement",
  "createFooter"     : "SafeElement",
  "createMain"       : "SafeElement",
  "createAside"      : "SafeElement",
  "createFigure"     : "SafeElement",
  "createFigcaption" : "SafeElement",
  "createText"       : "SafeElement",
  "createHeading"    : "SafeElement",
  "createFormatting" : "SafeElement",
  "createBlockquote" : "SafeElement",
  "createPre"        : "SafeElement",
  "createList"       : "SafeListElement",
  "createListItem"   : "SafeElement",
  "createTerm"       : "SafeElement",
  "createDescription": "SafeElement",
  "createTable"      : "SafeElement",
  "createThead"      : "SafeElement",
  "createTbody"      : "SafeElement",
  "createTfoot"      : "SafeElement",
  "createTr"         : "SafeElement",
  "createTh"         : "SafeTableCellElement",
  "createTd"         : "SafeTableCellElement",
  "createCaption"    : "SafeElement",
  "createColgroup"   : "SafeElement",
  "createCol"        : "SafeElement",
  "createButton"     : "SafeButtonElement",
  "createInput"      : "SafeInputElement",
  "createSelect"     : "SafeSelectElement",
  "createOption"     : "SafeOptionElement",
  "createOptgroup"   : "SafeElement",
  "createTextarea"   : "SafeTextareaElement",
  "createLabel"      : "SafeLabelElement",
  "createFieldset"   : "SafeFieldsetElement",
  "createLegend"     : "SafeElement",
  "createImage"      : "SafeImageElement",
  "createVideo"      : "SafeVideoElement",
  "createAudio"      : "SafeAudioElement",
  "createSource"     : "SafeSourceElement",
  "createTrack"      : "SafeElement",
  "createPicture"    : "SafeElement",
  "createCanvas"     : "SafeCanvasElement",
  "createAnchor"     : "SafeAnchorElement",
  "createDetails"    : "SafeDetailsElement",
  "createSummary"    : "SafeElement",
  "createDialog"     : "SafeDialogElement",
  "createHr"         : "SafeElement",
  "createBr"         : "SafeElement",
  "createWbr"        : "SafeElement",
  "createProgress"   : "SafeProgressElement",
  "createMeter"      : "SafeMeterElement",
  "createOutput"     : "SafeElement",
  "createTime"       : "SafeElement",
  "createData"       : "SafeElement",
  "createRuby"       : "SafeElement",
  "createRt"         : "SafeElement",
  "createRp"         : "SafeElement",
  "createRawText"    : "SafeTextNode",
  "createStyle"      : "SafeStyleSheet",
} as const satisfies Record<Factory, keyof typeof Methods>;
