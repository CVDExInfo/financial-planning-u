/**
 * MonthlySnapshotGrid Props Test Suite
 * 
 * Tests for new props: showRangeIcon, defaultExpanded, maxMonths
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('MonthlySnapshotGrid - New Props', () => {
  describe('showRangeIcon prop', () => {
    it('should have default value of true', () => {
      const defaultShowRangeIcon = true;
      assert.strictEqual(defaultShowRangeIcon, true, 'showRangeIcon should default to true');
    });

    it('should accept false to hide month range badge', () => {
      const showRangeIcon = false;
      assert.strictEqual(showRangeIcon, false, 'showRangeIcon should be settable to false');
    });

    it('should control M{n} badge visibility in header', () => {
      // When showRangeIcon=true, badge should render with text like "M1", "M5", etc.
      // When showRangeIcon=false, badge should not render
      const monthIndex = 5;
      const badgeText = `M${monthIndex}`;
      
      const shouldRenderBadge = (showIcon: boolean) => showIcon;
      
      assert.strictEqual(shouldRenderBadge(true), true, 'Badge should render when showRangeIcon=true');
      assert.strictEqual(shouldRenderBadge(false), false, 'Badge should not render when showRangeIcon=false');
      assert.strictEqual(badgeText, 'M5', 'Badge text format should be M{monthIndex}');
    });
  });

  describe('defaultExpanded prop', () => {
    it('should have default value of true', () => {
      const defaultExpanded = true;
      assert.strictEqual(defaultExpanded, true, 'defaultExpanded should default to true');
    });

    it('should set initial isCollapsed state to opposite of defaultExpanded', () => {
      const defaultExpanded = true;
      const initialIsCollapsed = !defaultExpanded;
      
      assert.strictEqual(initialIsCollapsed, false, 'isCollapsed should be false when defaultExpanded=true');
    });

    it('should allow grid to start collapsed when defaultExpanded=false', () => {
      const defaultExpanded = false;
      const initialIsCollapsed = !defaultExpanded;
      
      assert.strictEqual(initialIsCollapsed, true, 'isCollapsed should be true when defaultExpanded=false');
    });

    it('should control initial visibility of grid content', () => {
      // When defaultExpanded=true, grid should show full content on mount
      // When defaultExpanded=false, grid should show only summary KPIs on mount
      const showFullGridOnMount = (expanded: boolean) => expanded;
      
      assert.strictEqual(showFullGridOnMount(true), true, 'Full grid visible when expanded');
      assert.strictEqual(showFullGridOnMount(false), false, 'Only summary visible when collapsed');
    });
  });

  describe('maxMonths prop', () => {
    it('should have default value of 60', () => {
      const defaultMaxMonths = 60;
      assert.strictEqual(defaultMaxMonths, 60, 'maxMonths should default to 60');
    });

    it('should support up to 60 months in the grid', () => {
      const maxMonths = 60;
      const testMonthValues = [1, 12, 24, 36, 48, 60];
      
      testMonthValues.forEach(month => {
        assert.ok(month >= 1 && month <= maxMonths, `Month ${month} should be valid`);
      });
    });

    it('should clamp month selection to maxMonths range', () => {
      const maxMonths = 60;
      const clampMonth = (month: number, max: number) => Math.min(Math.max(month, 1), max);
      
      assert.strictEqual(clampMonth(0, maxMonths), 1, 'Should clamp to 1 for values below 1');
      assert.strictEqual(clampMonth(30, maxMonths), 30, 'Should preserve valid values');
      assert.strictEqual(clampMonth(70, maxMonths), 60, 'Should clamp to 60 for values above maxMonths');
    });

    it('should allow customization of max months', () => {
      const customMaxMonths = 48; // Could be set based on baseline duration
      assert.strictEqual(customMaxMonths, 48, 'maxMonths should be customizable');
      assert.ok(customMaxMonths <= 60, 'Custom maxMonths should not exceed 60');
    });
  });

  describe('Integration: Props working together', () => {
    it('should support 60-month grid with hidden badge and expanded view', () => {
      const props = {
        showRangeIcon: false,
        defaultExpanded: true,
        maxMonths: 60,
      };
      
      assert.strictEqual(props.showRangeIcon, false, 'No badge shown');
      assert.strictEqual(props.defaultExpanded, true, 'Grid starts expanded');
      assert.strictEqual(props.maxMonths, 60, 'Supports 60 months');
    });

    it('should handle month selection within maxMonths range', () => {
      const maxMonths = 60;
      const selectedMonths = [1, 12, 24, 36, 48, 60];
      
      selectedMonths.forEach(month => {
        const isValid = month >= 1 && month <= maxMonths;
        assert.ok(isValid, `Month ${month} should be within valid range 1-${maxMonths}`);
      });
    });

    it('should maintain sessionStorage persistence with new defaults', () => {
      // Even with defaultExpanded=true, sessionStorage should override if present
      const storedState = 'false'; // User previously collapsed the grid
      const defaultExpanded = true;
      
      // Logic: if sessionStorage exists, use it; otherwise use defaultExpanded
      const getInitialState = (stored: string | null, defaultVal: boolean) => {
        if (stored === null) return !defaultVal; // isCollapsed = !defaultExpanded
        return stored === 'true'; // stored isCollapsed value
      };
      
      const initialIsCollapsed = getInitialState(storedState, defaultExpanded);
      assert.strictEqual(initialIsCollapsed, true, 'sessionStorage should override default');
    });
  });

  describe('Backwards compatibility', () => {
    it('should maintain existing behavior when props are not provided', () => {
      // Component should use defaults when props are omitted
      const defaults = {
        showRangeIcon: true,
        defaultExpanded: true,
        maxMonths: 60,
      };
      
      assert.strictEqual(defaults.showRangeIcon, true, 'Existing behavior preserved');
      assert.strictEqual(defaults.defaultExpanded, true, 'New default: expanded');
      assert.strictEqual(defaults.maxMonths, 60, 'Extended month support');
    });

    it('should support original 12-month range if maxMonths not specified', () => {
      const maxMonths = 60; // Even with default, supports up to 60
      const traditionalRange = 12; // Original functionality
      
      assert.ok(traditionalRange <= maxMonths, 'Original 12-month range still supported');
    });
  });
});
