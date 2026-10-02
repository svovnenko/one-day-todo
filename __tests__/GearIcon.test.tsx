import { render } from '@testing-library/react-native';
import type { ReactTestRendererJSON, ReactTestRendererNode } from 'react-test-renderer';

import { GearIcon } from '@/components/icons/GearIcon';

function findByProp(
  node: ReactTestRendererNode | ReactTestRendererNode[] | null,
  predicate: (props: Record<string, unknown>) => boolean
): ReactTestRendererJSON | null {
  if (!node || typeof node === 'string') return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByProp(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node.props)) return node;
  return findByProp(node.children, predicate);
}

// react-native-svg packs color props into { type: 0, payload: <ARGB int> }
// rather than keeping the hex string -- #RRGGBB with full alpha is 0xFFRRGGBB.
function packedColor(hex: string): number {
  return 0xff000000 + parseInt(hex.slice(1), 16);
}

it('renders with the given size and color (spec v8.2: inline SVG, not @expo/vector-icons)', async () => {
  const screen = await render(<GearIcon size={24} color="#112233" />);
  const tree = screen.toJSON();

  expect(findByProp(tree, (props) => props.width === 24 && props.height === 24)).toBeTruthy();
  const path = findByProp(tree, (props) => props.strokeWidth === 32);
  expect(path).toBeTruthy();
  expect((path?.props.stroke as { payload: number }).payload).toBe(packedColor('#112233'));
});

it('defaults to size 20', async () => {
  const screen = await render(<GearIcon color="#000000" />);
  const tree = screen.toJSON();

  expect(findByProp(tree, (props) => props.width === 20 && props.height === 20)).toBeTruthy();
});
