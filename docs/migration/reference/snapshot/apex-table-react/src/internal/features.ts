import { columnFilteringFeature, columnOrderingFeature, columnPinningFeature, columnResizingFeature, columnSizingFeature, columnVisibilityFeature, createFilteredRowModel, createPaginatedRowModel, createSortedRowModel, filterFns, globalFilteringFeature, rowPaginationFeature, rowSelectionFeature, rowSortingFeature, sortFns, tableFeatures } from '@tanstack/react-table';

/*
 * 数据模式统一安装受支持的特性及本地行模型，消费方无需注册第三方模块。
 * 特性集合保持稳定，运行期间切换 props 不重建实例、不丢失受控或内部状态。
 * 内置比较器和过滤器支持原生字符串名称，自定义函数仍可直接写在列定义中。
 */
export const managedFeatures = tableFeatures({
  columnFilteringFeature, globalFilteringFeature, rowSortingFeature, rowPaginationFeature, rowSelectionFeature,
  columnOrderingFeature, columnPinningFeature, columnResizingFeature, columnSizingFeature, columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(), sortedRowModel: createSortedRowModel(), paginatedRowModel: createPaginatedRowModel(),
  filterFns, sortFns,
});
