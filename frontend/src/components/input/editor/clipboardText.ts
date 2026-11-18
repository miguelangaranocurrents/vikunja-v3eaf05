import type {Fragment, Node as PMNode, Slice} from '@tiptap/pm/model'

const LIST_TYPES = new Set(['bulletList', 'orderedList', 'taskList'])

function isList(node: PMNode): boolean {
	return LIST_TYPES.has(node.type.name)
}

function leafText(leaf: PMNode): string {
	const fromSpec = leaf.type.spec.leafText?.(leaf)
	if (typeof fromSpec === 'string') {
		return fromSpec
	}
	return leaf.type.name === 'hardBreak' ? '\n' : ''
}

function inlineText(node: PMNode): string {
	return node.textBetween(0, node.content.size, '\n', leafText)
}

function serializeList(list: PMNode, indent: string): string {
	const ordered = list.type.name === 'orderedList'
	let index = typeof list.attrs.start === 'number' ? list.attrs.start : 1
	const lines: string[] = []

	list.forEach(item => {
		let marker = ordered ? `${index++}. ` : '- '
		if (item.type.name === 'taskItem') {
			marker = `- [${item.attrs.checked ? 'x' : ' '}] `
		}
		const continuation = indent + ' '.repeat(marker.length)
		let first = true

		item.forEach(child => {
			if (isList(child)) {
				lines.push(serializeList(child, continuation))
				return
			}
			const text = child.isTextblock ? inlineText(child) : serializeFragment(child.content)
			const prefixed = text
				.split('\n')
				.map((line, i) => (first && i === 0 ? indent + marker : continuation) + line)
				.join('\n')
			lines.push(prefixed)
			first = false
		})

		if (first) {
			lines.push(indent + marker.trimEnd())
		}
	})

	return lines.join('\n')
}

function serializeFragment(fragment: Fragment): string {
	if (fragment.firstChild?.isInline) {
		return fragment.textBetween(0, fragment.size, '\n', leafText)
	}

	const blocks: string[] = []
	fragment.forEach(node => {
		if (isList(node)) {
			blocks.push(serializeList(node, ''))
		} else if (node.isTextblock) {
			blocks.push(inlineText(node))
		} else if (node.isLeaf) {
			blocks.push(leafText(node))
		} else {
			blocks.push(serializeFragment(node.content))
		}
	})
	return blocks.join('\n\n')
}

/**
 * Plain text representation of copied editor content. Unlike the default
 * serializer it keeps list markers so a copied list stays a list.
 */
export function serializeSliceAsText(slice: Slice): string {
	let content = slice.content
	let open = Math.min(slice.openStart, slice.openEnd)

	// A selection inside a single block should not pick up the markers of its ancestors.
	while (
		open > 0 &&
		content.childCount === 1 &&
		content.firstChild &&
		!content.firstChild.isTextblock &&
		!(isList(content.firstChild) && content.firstChild.childCount > 1)
	) {
		content = content.firstChild.content
		open--
	}

	return serializeFragment(content)
}
