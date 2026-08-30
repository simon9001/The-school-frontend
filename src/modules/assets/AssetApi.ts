import { createApi } from '@reduxjs/toolkit/query/react'
import { authBaseQuery } from '../../apiDomain/authBaseQuery'
import type { ApiEnvelope } from '../../types/Types'
import type {
  AcquireAssetValues,
  Asset,
  AssetCategory,
  AssetDisposal,
  DepreciationEntry,
  DisposeAssetValues,
  NewAssetCategoryValues,
  RunDepreciationValues,
} from './types'

export const assetApi = createApi({
  reducerPath: 'assetApi',
  baseQuery: authBaseQuery,
  tagTypes: ['AssetCategories', 'Assets'],
  endpoints: (builder) => ({
    getAllAssetCategories: builder.query<AssetCategory[], void>({
      query: () => 'assets/categories',
      transformResponse: (response: ApiEnvelope<AssetCategory[]>) => response.data,
      providesTags: ['AssetCategories'],
    }),

    createAssetCategory: builder.mutation<AssetCategory, NewAssetCategoryValues>({
      query: (body) => ({ url: 'assets/categories', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<AssetCategory>) => response.data,
      invalidatesTags: ['AssetCategories'],
    }),

    getAllAssets: builder.query<Asset[], void>({
      query: () => 'assets',
      transformResponse: (response: ApiEnvelope<Asset[]>) => response.data,
      providesTags: ['Assets'],
    }),

    getAssetById: builder.query<Asset, number>({
      query: (id) => `assets/${id}`,
      transformResponse: (response: ApiEnvelope<Asset>) => response.data,
      providesTags: ['Assets'],
    }),

    acquireAsset: builder.mutation<Asset, AcquireAssetValues>({
      query: (body) => ({ url: 'assets', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<Asset>) => response.data,
      invalidatesTags: ['Assets'],
    }),

    runDepreciation: builder.mutation<DepreciationEntry[], RunDepreciationValues>({
      query: (body) => ({ url: 'assets/depreciation-runs', method: 'POST', body }),
      transformResponse: (response: ApiEnvelope<DepreciationEntry[]>) => response.data,
      invalidatesTags: ['Assets'],
    }),

    disposeAsset: builder.mutation<AssetDisposal, { id: number; values: DisposeAssetValues }>({
      query: ({ id, values }) => ({ url: `assets/${id}/dispose`, method: 'POST', body: values }),
      transformResponse: (response: ApiEnvelope<AssetDisposal>) => response.data,
      invalidatesTags: ['Assets'],
    }),
  }),
})

export const {
  useGetAllAssetCategoriesQuery,
  useCreateAssetCategoryMutation,
  useGetAllAssetsQuery,
  useGetAssetByIdQuery,
  useAcquireAssetMutation,
  useRunDepreciationMutation,
  useDisposeAssetMutation,
} = assetApi
