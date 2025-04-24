import { nextTick } from 'vue'
import { isEqual } from 'lodash-unified'
import Node from './node'

import { CascaderPanelFilterFunction, ElCascaderPanelContext } from './types'
import type { Nullable } from '@element-plus/utils'
import type {
  CascaderConfig,
  CascaderNodePathValue,
  CascaderNodeValue,
  CascaderOption,
} from './node'

const flatNodes = (nodes: Node[], leafOnly: boolean) => {
  return nodes.reduce((res, node) => {
    if (node.isLeaf) {
      res.push(node)
    } else {
      !leafOnly && res.push(node)
      res = res.concat(flatNodes(node.children, leafOnly))
    }
    return res
  }, [] as Node[])
}

export default class Store {
  readonly nodes: Node[]
  readonly allNodes: Node[]
  readonly leafNodes: Node[]
  readonly filterFn: CascaderPanelFilterFunction
  readonly ctx: ElCascaderPanelContext

  constructor(
    data: CascaderOption[],
    readonly config: CascaderConfig,
    context: ElCascaderPanelContext,
    filterFn: CascaderPanelFilterFunction
  ) {
    const nodes = (data || []).map(
      (nodeData) => new Node(nodeData, this.config)
    )
    this.nodes = nodes
    this.allNodes = flatNodes(nodes, false)
    this.leafNodes = flatNodes(nodes, true)
    this.filterFn = filterFn
    this.ctx = context
  }

  filter(value: any) {
    const filterFn = this.filterFn
    const lazy = this.config.lazy
    const expandNode = this.ctx.expandNode

    const traverse = async function (node: Node) {
      const childNodes = node.children

      for (const [index, child] of childNodes.entries()) {
        child.visible = filterFn.call(child, value, child.data, child)
        if (index % 80 === 0 && index > 0) {
          await nextTick()
        }
        traverse(child)
      }

      if ('visible' in node && !node.visible && childNodes.length) {
        let allHidden = true
        allHidden = !childNodes.some((child) => child.visible)

        node.visible = allHidden === false
      }

      if (!value) return

      if (node.visible && !node.isLeaf) {
        if (!lazy || node.loaded) {
          expandNode(node)
        }
      }
    }

    traverse({ children: this.nodes } as Node)
  }

  getNodes() {
    return this.nodes
  }

  getFlattedNodes(leafOnly: boolean) {
    return leafOnly ? flatNodes(this.nodes, true) : this.allNodes
  }

  appendNode(nodeData: CascaderOption, parentNode?: Node) {
    const node = parentNode
      ? parentNode.appendChild(nodeData)
      : new Node(nodeData, this.config)

    if (!parentNode) this.nodes.push(node)

    this.appendAllNodesAndLeafNodes(node)
  }

  appendNodes(nodeDataList: CascaderOption[], parentNode: Node) {
    nodeDataList.forEach((nodeData) => this.appendNode(nodeData, parentNode))
  }

  appendAllNodesAndLeafNodes(node: Node) {
    this.allNodes.push(node)
    node.isLeaf && this.leafNodes.push(node)
    if (node.children) {
      node.children.forEach((subNode) => {
        this.appendAllNodesAndLeafNodes(subNode)
      })
    }
  }

  // when checkStrictly, leaf node first
  getNodeByValue(
    value: CascaderNodeValue | CascaderNodePathValue,
    leafOnly = false
  ): Nullable<Node> {
    if (!value && value !== 0) return null

    const node = this.getFlattedNodes(leafOnly).find(
      (node) => isEqual(node.value, value) || isEqual(node.pathValues, value)
    )

    return node || null
  }

  getSameNode(node: Node): Nullable<Node> {
    if (!node) return null

    const node_ = this.getFlattedNodes(false).find(
      ({ value, level }) => isEqual(node.value, value) && node.level === level
    )

    return node_ || null
  }
}
