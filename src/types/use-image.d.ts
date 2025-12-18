declare module 'use-image' {
  type Status = 'loading' | 'loaded' | 'failed'
  function useImage(url: string | null): [HTMLImageElement | undefined, Status]
  export default useImage
}


