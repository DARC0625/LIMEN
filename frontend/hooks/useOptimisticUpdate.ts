/**
 * Optimistic Update 훅
 * 서버 응답을 기다리지 않고 즉시 UI 업데이트
 */
import { useMutation, useQueryClient, UseMutationOptions } from '@tanstack/react-query';
import { startTransition } from 'react';

export interface OptimisticUpdateOptions<TData, TVariables, TError> {
  queryKey: string[];
  updateFn: (old: TData | undefined, variables: TVariables) => TData;
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: TError, variables: TVariables, context?: { previousData?: TData }) => void;
  mutationOptions?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>;
}

/**
 * Optimistic Update를 지원하는 Mutation 훅
 * @param mutationFn - 실제 API 호출 함수
 * @param options - Optimistic Update 옵션
 * @returns Mutation 객체
 */
export function useOptimisticUpdate<TData, TVariables, TError = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: OptimisticUpdateOptions<TData, TVariables, TError>
) {
  const queryClient = useQueryClient();
  const { queryKey, updateFn, onSuccess, onError, mutationOptions } = options;

  return useMutation({
    mutationFn,
    ...mutationOptions,
    onMutate: async (variables) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey });

      // 이전 값 저장 (롤백용)
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistic Update
      queryClient.setQueryData<TData>(queryKey, (old) => updateFn(old, variables));

      return { previousData };
    },
    onError: (error, variables, context) => {
      // 에러 발생 시 롤백
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      onError?.(error, variables, context);
      // mutationOptions의 onError는 React Query의 표준 시그니처를 따름
      // 4번째 인자(mutation)는 선택적이므로 undefined 전달
      if (mutationOptions?.onError) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationOptions.onError(error, variables, context, undefined as any);
      }
    },
    onSuccess: (data, variables, context) => {
      // 성공 시 최신 데이터로 업데이트
      startTransition(() => {
        queryClient.setQueryData(queryKey, data);
        queryClient.invalidateQueries({ queryKey });
      });
      onSuccess?.(data, variables);
      // mutationOptions의 onSuccess는 React Query의 표준 시그니처를 따름
      // 4번째 인자(mutation)는 선택적이므로 undefined 전달
      if (mutationOptions?.onSuccess) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationOptions.onSuccess(data, variables, context, undefined as any);
      }
    },
    onSettled: (data, error, variables, context) => {
      // 최종적으로 쿼리 무효화
      startTransition(() => {
        queryClient.invalidateQueries({ queryKey });
      });
      // mutationOptions의 onSettled는 React Query의 표준 시그니처를 따름
      // 5번째 인자(mutation)는 선택적이므로 undefined 전달
      if (mutationOptions?.onSettled) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mutationOptions.onSettled(data, error, variables, context, undefined as any);
      }
    },
  });
}



