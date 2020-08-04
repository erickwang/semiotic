// modules
import * as React from "react"
import { bumpAnnotations } from "./annotationLayerBehavior/annotationHandling"

import Legend from "./Legend"
import Annotation from "./Annotation"
import * as labella from "labella"
import { HOCSpanOrDiv } from "./SpanOrDiv"

import {
  AnnotationHandling,
  AnnotationTypes,
  AnnotationProps
} from "./types/annotationTypes"

import { LegendProps } from "./types/legendTypes"

interface NoteType {
  key: string
  props: AnnotationProps
}

export interface AnnotationLayerProps {
  useSpans: boolean
  legendSettings?: LegendProps
  margin: { top?: number; left?: number; right?: number; bottom?: number }
  size: number[]
  axes?: React.ReactNode[]
  annotationHandling?: AnnotationHandling | AnnotationTypes
  annotations: Object[]
  pointSizeFunction?: Function
  labelSizeFunction?: Function
  svgAnnotationRule: Function
  htmlAnnotationRule: Function
  voronoiHover: Function
  position?: number[]
}

interface AnnotationLayerState {
  svgAnnotations: Object[]
  htmlAnnotations: Object[]
  adjustedAnnotationsKey?: string
  adjustedAnnotationsDataVersion?: string
  adjustedAnnotations: Object[]
  SpanOrDiv: Function
}

function marginOffsetFn(orient, axisSettings, marginOffset) {
  if (typeof marginOffset === "number") {
    return marginOffset
  }
  if (axisSettings && axisSettings.find(d => d.props.orient === orient)) {
    return 50
  }
  return 10
}

function adjustedAnnotationKeyMapper(d) {
  const { note = {} } = d.props.noteData
  const { label, title } = note
  const id =
    d.props.noteData.id || `${d.props.noteData.x}-${d.props.noteData.y}`
  return `${id}-${label}=${title}`
}

function noteDataWidth(noteData, charWidth = 8, layoutNoteWidth) {
  let { noteWidth = layoutNoteWidth } = noteData

  let noteWidthFn = noteWidth

  if (typeof noteWidth === "number") {
    noteWidthFn = () => noteWidth
  }

  const wrap = (noteData.note && noteData.note.wrap) || 120
  const noteText = noteData.note.label || noteData.note.label || ""
  const width =
    (noteWidth && noteWidthFn(noteData)) ||
    (React.isValidElement(noteData.note)
      ? 100
      : Math.min(wrap, noteText.length * charWidth))
  return width
}

function noteDataHeight(
  noteData,
  charWidth = 8,
  lineHeight = 20,
  layoutNoteHeight
) {
  let { noteHeight = layoutNoteHeight } = noteData

  let noteHeightFn = noteHeight

  if (typeof noteHeight === "number") {
    noteHeightFn = () => noteHeight
  }
  const wrap = (noteData.note && noteData.note.wrap) || 120
  const text = noteData.note.label || noteData.note.title || ""
  const height =
    (noteHeight && noteHeightFn(noteData)) ||
    (React.isValidElement(noteData.note)
      ? 30
      : Math.ceil((text.length * charWidth) / wrap) * lineHeight +
        (noteData.note.label && noteData.note.title ? lineHeight : 0))

  return height
}

const processAnnotations = (
  adjustableAnnotations: NoteType[],
  annotationProcessor: AnnotationHandling,
  props: AnnotationLayerProps
) => {
  const {
    layout = { type: false, noteHeight: undefined, noteWidth: undefined }
  } = annotationProcessor

  if (layout.type === false) {
    return adjustableAnnotations
  }

  const { noteWidth: layoutNoteHeight, noteHeight: layoutNoteWidth } = layout

  let { margin = { top: 0, bottom: 0, left: 0, right: 0 } } = props

  const { size, axes = [] } = props

  margin =
    typeof margin === "number"
      ? { top: margin, left: margin, right: margin, bottom: margin }
      : margin

  if (layout.type === "bump") {
    const adjustedAnnotations = bumpAnnotations(
      adjustableAnnotations,
      layout,
      size,
      props.pointSizeFunction,
      props.labelSizeFunction
    )
    return adjustedAnnotations
  } else if (layout.type === "marginalia") {
    const {
      marginOffset,
      orient = "nearest",
      characterWidth = 8,
      lineHeight = 20,
      padding = 2,
      axisMarginOverride = {}
    } = layout
    const finalOrientation =
      orient === "nearest"
        ? ["left", "right", "top", "bottom"]
        : Array.isArray(orient)
        ? orient
        : [orient]

    const leftOn = finalOrientation.find(d => d === "left")
    const rightOn = finalOrientation.find(d => d === "right")
    const topOn = finalOrientation.find(d => d === "top")
    const bottomOn = finalOrientation.find(d => d === "bottom")

    const leftNodes = []
    const rightNodes = []
    const topNodes = []
    const bottomNodes = []

    adjustableAnnotations.forEach((aNote: NoteType) => {
      const noteData = aNote.props.noteData

      const noteX = noteData.x[0] || noteData.x
      const noteY = noteData.y[0] || noteData.y

      const leftDist = leftOn ? noteX : Infinity
      const rightDist = rightOn ? size[0] - noteX : Infinity
      const topDist = topOn ? noteY : Infinity
      const bottomDist = bottomOn ? size[1] - noteY : Infinity

      const minDist = Math.min(leftDist, rightDist, topDist, bottomDist)

      if (leftDist === minDist) {
        leftNodes.push(aNote)
      } else if (rightDist === minDist) {
        rightNodes.push(aNote)
      } else if (topDist === minDist) {
        topNodes.push(aNote)
      } else {
        bottomNodes.push(aNote)
      }
    })

    //Adjust the margins based on which regions are active

    const leftForce = new labella.Force({
      minPos:
        axisMarginOverride.top !== undefined
          ? 0 + axisMarginOverride.top
          : 0 - margin.top,
      maxPos:
        axisMarginOverride.bottom !== undefined
          ? size[1] - axisMarginOverride.bottom
          : bottomOn
          ? size[1]
          : size[1] + margin.bottom
    })
      .nodes(
        leftNodes.map(d => {
          const noteY = d.props.noteData.y[0] || d.props.noteData.y
          return new labella.Node(
            noteY,
            noteDataHeight(
              d.props.noteData,
              characterWidth,
              lineHeight,
              layoutNoteHeight
            ) + padding
          )
        })
      )
      .compute()

    const rightForce = new labella.Force({
      minPos:
        axisMarginOverride.top !== undefined
          ? 0 + axisMarginOverride.top
          : topOn
          ? 0
          : 0 - margin.top,
      maxPos:
        axisMarginOverride.bottom !== undefined
          ? size[1] - axisMarginOverride.bottom
          : size[1] + margin.bottom
    })
      .nodes(
        rightNodes.map(d => {
          const noteY = d.props.noteData.y[0] || d.props.noteData.y
          return new labella.Node(
            noteY,
            noteDataHeight(
              d.props.noteData,
              characterWidth,
              lineHeight,
              layoutNoteHeight
            ) + padding
          )
        })
      )
      .compute()

    const topForce = new labella.Force({
      minPos:
        axisMarginOverride.left !== undefined
          ? 0 + axisMarginOverride.left
          : leftOn
          ? 0
          : 0 - margin.left,
      maxPos:
        axisMarginOverride.right !== undefined
          ? size[0] - axisMarginOverride.right
          : size[0] + margin.right
    })
      .nodes(
        topNodes.map(d => {
          const noteX = d.props.noteData.x[0] || d.props.noteData.x
          return new labella.Node(
            noteX,
            noteDataWidth(d.props.noteData, characterWidth, layoutNoteWidth) +
              padding
          )
        })
      )
      .compute()

    const bottomForce = new labella.Force({
      minPos:
        axisMarginOverride.left !== undefined
          ? 0 + axisMarginOverride.left
          : 0 - margin.left,
      maxPos:
        axisMarginOverride.right !== undefined
          ? size[0] - axisMarginOverride.right
          : rightOn
          ? size[0]
          : size[0] + margin.right
    })
      .nodes(
        bottomNodes.map(d => {
          const noteX = d.props.noteData.x[0] || d.props.noteData.x
          return new labella.Node(
            noteX,
            noteDataWidth(d.props.noteData, characterWidth, layoutNoteWidth) +
              padding
          )
        })
      )
      .compute()

    const bottomOffset = Math.max(
      ...bottomNodes.map(
        d =>
          noteDataHeight(
            d.props.noteData,
            characterWidth,
            lineHeight,
            layoutNoteHeight
          ) + padding
      )
    )
    const topOffset = Math.max(
      ...topNodes.map(
        d =>
          noteDataHeight(
            d.props.noteData,
            characterWidth,
            lineHeight,
            layoutNoteHeight
          ) + padding
      )
    )
    const leftOffset = Math.max(
      ...leftNodes.map(
        d =>
          noteDataWidth(d.props.noteData, characterWidth, layoutNoteWidth) +
          padding
      )
    )
    const rightOffset = Math.max(
      ...rightNodes.map(
        d =>
          noteDataWidth(d.props.noteData, characterWidth, layoutNoteWidth) +
          padding
      )
    )

    //      const nodeOffsetHeight = Math.max()

    const leftSortedNodes = leftForce.nodes()
    const rightSortedNodes = rightForce.nodes()
    const topSortedNodes = topForce.nodes()
    const bottomSortedNodes = bottomForce.nodes()

    leftNodes.forEach((note, i) => {
      const x =
        0 -
        leftSortedNodes[i].layerIndex * leftOffset -
        marginOffsetFn("left", axes, marginOffset)

      const y = leftSortedNodes[i].currentPos
      note.props.noteData.nx = x
      note.props.noteData.ny = y

      if (note.props.noteData.note && !React.isValidElement(note)) {
        note.props.noteData.note.orientation =
          note.props.noteData.note.orientation || "leftRight"
        note.props.noteData.note.align =
          note.props.noteData.note.align || "right"
      }
    })

    rightNodes.forEach((note, i) => {
      const x =
        size[0] +
        rightSortedNodes[i].layerIndex * rightOffset +
        marginOffsetFn("right", axes, marginOffset)
      const y = rightSortedNodes[i].currentPos

      note.props.noteData.nx = x
      note.props.noteData.ny = y

      if (note.props.noteData.note && !React.isValidElement(note)) {
        note.props.noteData.note.orientation =
          note.props.noteData.note.orientation || "leftRight"
        note.props.noteData.note.align =
          note.props.noteData.note.align || "left"
      }
    })

    topNodes.forEach((note, i) => {
      const x = topSortedNodes[i].currentPos
      const y =
        0 -
        topSortedNodes[i].layerIndex * topOffset -
        marginOffsetFn("top", axes, marginOffset)

      note.props.noteData.nx = x
      note.props.noteData.ny = y
    })

    bottomNodes.forEach((note, i) => {
      const x = bottomSortedNodes[i].currentPos
      const y =
        size[1] +
        bottomSortedNodes[i].layerIndex * bottomOffset +
        marginOffsetFn("bottom", axes, marginOffset)

      note.props.noteData.nx = x
      note.props.noteData.ny = y
    })

    return adjustableAnnotations
  }
  return adjustableAnnotations
}

const generateSVGAnnotations = (
  props: AnnotationLayerProps,
  annotations: Object[]
): NoteType[] => {
  const renderedAnnotations = annotations
    .map((d, i) => props.svgAnnotationRule(d, i, props))
    .filter(d => d !== null && d !== undefined)

  return renderedAnnotations
}

const generateHTMLAnnotations = (
  props: AnnotationLayerProps,
  annotations: Object[]
): Object[] => {
  const renderedAnnotations = annotations
    .map((d, i) => props.htmlAnnotationRule(d, i, props))
    .filter(d => d !== null && d !== undefined)

  return renderedAnnotations
}

const createAnnotations = (
  props: AnnotationLayerProps,
  state: AnnotationLayerState
) => {
  console.log(" in createAnnotations")
  let renderedSVGAnnotations = state.svgAnnotations,
    renderedHTMLAnnotations = [],
    adjustedAnnotations = state.adjustedAnnotations,
    adjustableAnnotationsKey = state.adjustedAnnotationsKey

  const adjustedAnnotationsKey = state.adjustedAnnotationsKey,
    adjustedAnnotationsDataVersion = state.adjustedAnnotationsDataVersion

  const {
    annotations,
    annotationHandling = false,
    size,
    svgAnnotationRule,
    htmlAnnotationRule
  } = props

  const annotationProcessor: AnnotationHandling =
    typeof annotationHandling === "object"
      ? annotationHandling
      : { layout: { type: annotationHandling }, dataVersion: "" }

  const { dataVersion = "" } = annotationProcessor

  if (svgAnnotationRule) {
    const initialSVGAnnotations: NoteType[] = generateSVGAnnotations(
      props,
      annotations
    )
    const adjustableAnnotations = initialSVGAnnotations.filter(
      d => d.props && d.props.noteData && !d.props.noteData.fixedPosition
    )
    const fixedAnnotations = initialSVGAnnotations.filter(
      d => !d.props || !d.props.noteData || d.props.noteData.fixedPosition
    )
    adjustableAnnotationsKey = `${adjustableAnnotations
      .map(adjustedAnnotationKeyMapper)
      .join(",")}${JSON.stringify(annotationProcessor)}${size.join(",")}`

    if (annotationHandling === false) {
      adjustedAnnotations = adjustableAnnotations
    }

    if (
      adjustedAnnotations.length !== adjustableAnnotations.length ||
      adjustedAnnotationsKey !== adjustableAnnotationsKey ||
      adjustedAnnotationsDataVersion !== dataVersion
    ) {
      console.log("adjusted 1")
      adjustedAnnotations = processAnnotations(
        adjustableAnnotations,
        annotationProcessor,
        props
      )
    } else {
      //Handle when style or other attributes change
      console.log("adjusted 2")
      adjustedAnnotations = adjustableAnnotations.map((d: NoteType, i) => {
        const oldAnnotation = adjustedAnnotations[i] as NoteType
        const newNoteData = {
          ...oldAnnotation.props.noteData,
          ...d.props.noteData
        }

        return <Annotation key={d.key} noteData={newNoteData} />
      })
    }

    renderedSVGAnnotations = [...adjustedAnnotations, ...fixedAnnotations]
  }

  if (htmlAnnotationRule) {
    renderedHTMLAnnotations = generateHTMLAnnotations(props, annotations)
  }

  return {
    svgAnnotations: renderedSVGAnnotations,
    htmlAnnotations: renderedHTMLAnnotations,
    adjustedAnnotations: adjustedAnnotations,
    adjustedAnnotationsKey: adjustableAnnotationsKey,
    adjustedAnnotationsDataVersion: dataVersion
  }
}

class AnnotationLayer extends React.Component<
  AnnotationLayerProps,
  AnnotationLayerState
> {
  constructor(props: AnnotationLayerProps) {
    super(props)

    const baseState = {
      svgAnnotations: [],
      htmlAnnotations: [],
      adjustedAnnotations: [],
      adjustedAnnotationsKey: "",
      adjustedAnnotationsDataVersion: "",
      SpanOrDiv: HOCSpanOrDiv(props.useSpans)
    }

    this.state = {
      ...baseState,
      ...createAnnotations(props, baseState)
    }
  }

  static getDerivedStateFromProps(
    nextProps: AnnotationLayerProps,
    prevState: AnnotationLayerState
  ) {
    return createAnnotations(nextProps, prevState)
  }

  render() {
    const { svgAnnotations, htmlAnnotations, SpanOrDiv } = this.state
    const { legendSettings, margin, size } = this.props

    let renderedLegend
    if (legendSettings) {
      const positionHash = {
        left: [15, 15],
        right: [size[0] + 15, 15]
      }
      const { position = "right", title = "Legend" } = legendSettings
      const legendPosition = positionHash[position]
      renderedLegend = (
        <g transform={`translate(${legendPosition.join(",")})`}>
          <Legend {...legendSettings} title={title} position={position} />
        </g>
      )
    }

    return (
      <SpanOrDiv
        className="annotation-layer"
        style={{
          position: "absolute",
          pointerEvents: "none",
          background: "none"
        }}
      >
        <svg
          className="annotation-layer-svg"
          height={size[1]}
          width={size[0]}
          style={{
            background: "none",
            pointerEvents: "none",
            position: "absolute",
            left: `${margin.left}px`,
            top: `${margin.top}px`,
            overflow: "visible"
          }}
        >
          <g>
            {renderedLegend}
            {svgAnnotations}
          </g>
        </svg>
        <SpanOrDiv
          className="annotation-layer-html"
          style={{
            background: "none",
            pointerEvents: "none",
            position: "absolute",
            height: `${size[1]}px`,
            width: `${size[0]}px`,
            left: `${margin.left}px`,
            top: `${margin.top}px`
          }}
        >
          {htmlAnnotations}
        </SpanOrDiv>
      </SpanOrDiv>
    )
  }
}

export default AnnotationLayer
