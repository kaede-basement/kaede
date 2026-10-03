/*
 * Kaede, a Minecraft Launcher
 * Copyright (C) 2026  windstone <notwindstone@gmail.com> and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/*
 * The 'ark-of-atrahasis' 0.3.1 surface that sandboxed plugins use through the worker proxy.
 * The launcher accepts only the methods listed here; the worker builds node objects from it.
 * Methods starting with 'get' are answered by the worker, 'on' attach listeners,
 * and 'create' return new nodes.
 */

export type ArkKindType =
  | "document"
  | "element"
  | "input"
  | "textarea"
  | "select"
  | "option"
  | "button"
  | "label"
  | "fieldset"
  | "image"
  | "anchor"
  | "video"
  | "audio"
  | "source"
  | "canvas"
  | "tableCell"
  | "details"
  | "progress"
  | "meter"
  | "list"
  | "descriptionList"
  | "text"
  | "styleSheet";

const words = (list: string): Array<string> => list.trim().split(/\s+/);

const ElementMethods = words(`
  appendChild insertBefore removeChild replaceChild remove setText getText setClass getClass
  setId getId setTitle setRole setTabIndex setHidden setLang setDir setSpellcheck setData
  getData setAria getAria onClick onDblClick onMouseDown onMouseUp onMouseEnter onMouseLeave
  onMouseMove onPointerDown onPointerUp onPointerMove onContextMenu onKeyDown onKeyUp onFocus
  onBlur onTouchStart onTouchEnd onTouchMove onScroll
`);
const FormMethods = ["setDisabled", "setRequired", "setName"];
const TextInputMethods = [
  ...FormMethods,
  "setValue",
  "getValue",
  "setPlaceholder",
  "setReadonly",
  "setMinLength",
  "setMaxLength",
  "setAutocomplete",
  "onChange",
  "onInput",
];
const MediaMethods = ["setSrc", "setControls", "setAutoplay", "setLoop", "setMuted"];

const SimpleCreators = words(`
  createDiv createSpan createSection createArticle createNav createHeader createFooter
  createMain createAside createFigure createFigcaption createText createHeading
  createFormatting createBlockquote createPre createListItem createTerm createDescription
  createTable createThead createTbody createTfoot createTr createCaption createColgroup
  createCol createOptgroup createLegend createTrack createPicture createSummary
  createHr createBr createWbr createOutput createTime createData createRuby createRt createRp
`);

// The kind of the node every document creator returns; 'createList' depends on its argument
export const DocumentCreators: Readonly<Record<string, ArkKindType>> = {
  ...Object.fromEntries(SimpleCreators.map(creator => [creator, "element"])),
  "createDetails" : "details",
  "createDialog"  : "details",
  "createButton"  : "button",
  "createInput"   : "input",
  "createSelect"  : "select",
  "createOption"  : "option",
  "createTextarea": "textarea",
  "createLabel"   : "label",
  "createFieldset": "fieldset",
  "createImage"   : "image",
  "createVideo"   : "video",
  "createAudio"   : "audio",
  "createSource"  : "source",
  "createCanvas"  : "canvas",
  "createAnchor"  : "anchor",
  "createTh"      : "tableCell",
  "createTd"      : "tableCell",
  "createProgress": "progress",
  "createMeter"   : "meter",
  "createList"    : "list",
  "createRawText" : "text",
  "createStyle"   : "styleSheet",
};

// Without 'ui::interactivity', these document methods are 'undefined'
export const InteractiveCreators: ReadonlySet<string> = new Set(words(`
  createStyle createAnchor createCanvas createImage createVideo createAudio createSource
`));

const element = (...extra: Array<string>): ReadonlySet<string> => (
  new Set([...ElementMethods, ...extra.flatMap(list => words(list))])
);

export const ArkMethods: Readonly<Record<ArkKindType, ReadonlySet<string>>> = {
  "document": new Set([...Object.keys(DocumentCreators), "getElement"]),
  "element" : element(),
  "input"   : element(...TextInputMethods, `
    setType setChecked getChecked setMin setMax setStep setPattern setAutofocus setInputMode
    setEnterKeyHint
  `),
  "textarea"       : element(...TextInputMethods, "setRows setCols setWrap"),
  "select"         : element(...FormMethods, "setValue getValue setMultiple onChange"),
  "option"         : element("setValue setSelected setDisabled setLabel"),
  "button"         : element(...FormMethods, "setType setValue"),
  "label"          : element("setFor"),
  "fieldset"       : element("setDisabled"),
  "image"          : element("setSrc setAlt setWidth setHeight setLoading"),
  "anchor"         : element("setHref"),
  "video"          : element(...MediaMethods, "setWidth setHeight setPoster"),
  "audio"          : element(...MediaMethods),
  "source"         : element("setSrc setType"),
  "canvas"         : element("setWidth setHeight"),
  "tableCell"      : element("setColspan setRowspan setScope setHeaders"),
  "details"        : element("setOpen"),
  "progress"       : element("setValue setMax"),
  "meter"          : element("setValue setMin setMax"),
  "list"           : element("createItem"),
  "descriptionList": element("createTerm createDescription"),
  "text"           : new Set(words("setText getText remove")),
  "styleSheet"     : new Set(words("setCSS getCSS remove")),
};

// Value-bearing elements whose 'getValue'/'getChecked' the launcher keeps in sync
export const ValueKinds: ReadonlySet<ArkKindType> = new Set(["input", "textarea", "select"]);

// Ark validates these arguments synchronously and throws
const FormattingTags: ReadonlySet<unknown> = new Set(words(`
  strong em small b i u code kbd samp var sub sup mark abbr cite
`));

/**
 * Returns the kind of the node a creator returns, throwing like Ark for invalid arguments.
 *
 * @param creator - the name of the creating method
 * @param input - the creator arguments
 * @returns the kind of the new node
 */
export function getCreatedKind(creator: string, input: ReadonlyArray<unknown>): ArkKindType {
  const [argument] = input;

  switch (creator) {
    case "createHeading": {
      if ((argument as number) < 1 || (argument as number) > 6) {
        throw new Error("Heading level must be 1-6");
      }

      return "element";
    }
    case "createFormatting": {
      if (!FormattingTags.has(argument)) {
        throw new Error(`Unknown formatting tag: ${String(argument)}`);
      }

      return "element";
    }
    case "createList": {
      if (argument === "unordered" || argument === "ordered") {
        return "list";
      }

      if (argument === "description") {
        return "descriptionList";
      }

      throw new Error(`Unknown list type: ${String(argument)}`);
    }
    case "createItem":
    case "createTerm":
    case "createDescription": {
      return "element";
    }
    default: {
      return DocumentCreators[creator];
    }
  }
}

export type ArkStateType = {
  "field": "text" | "class" | "id" | "data" | "aria" | "css" | "style" | "value" | "checked";
  "key"  : string | undefined;
  "value": string | boolean | undefined;
};

/**
 * The state a setter call is expected to leave behind. The worker applies it to its mirror
 * at once, and the launcher sends a correction if Ark stored something else.
 *
 * @param kind - the kind of the target node
 * @param method - the setter name, or 'setStyle' for a 'style' property assignment
 * @param input - the call arguments
 * @returns the expected state, or 'undefined' for setters without a mirrored getter
 */
export function getExpectedState(
  kind: ArkKindType,
  method: string,
  input: ReadonlyArray<unknown>,
): ArkStateType | undefined {
  const [first, second] = input;

  switch (method) {
    case "setText": {
      return { "field": "text", "key": undefined, "value": String(first ?? "") };
    }
    case "setClass":
    case "setId": {
      return {
        "field": method === "setId" ? "id" : "class",
        "key"  : undefined,
        "value": String(first),
      };
    }
    case "setData":
    case "setAria": {
      return {
        "field": method === "setData" ? "data" : "aria",
        "key"  : String(first),
        "value": String(second),
      };
    }
    case "setCSS": {
      return { "field": "css", "key": undefined, "value": String(first ?? "") };
    }
    case "setStyle": {
      return { "field": "style", "key": String(first), "value": String(second ?? "") };
    }
    case "setValue": {
      return ValueKinds.has(kind)
        ? { "field": "value", "key": undefined, "value": String(first) }
        : undefined;
    }
    case "setChecked": {
      return { "field": "checked", "key": undefined, "value": Boolean(first) };
    }
    default: {
      return undefined;
    }
  }
}
