declare module '@deepseek-ai/cordis' {
  export interface Context {
    [key: string]: any
    effect(fn: () => void | (() => void), name?: string): void
  }
}

declare module 'cordis' {
  export interface Context {
    [key: string]: any
    effect(fn: () => void | (() => void), name?: string): void
  }
}

declare module '@deepseek-ai/schemastery' {
  export interface Schema<T = any> {
    [key: string]: any
    default(val: T): Schema<T>
  }
  export type SchemaType<T> = Schema<T>
  export interface Z {
    object(shape: Record<string, any>): Schema
    string(): Schema<string>
    number(): Schema<number>
    boolean(): Schema<boolean>
    [key: string]: any
  }
  const z: Z
  export default z
}

declare module 'schemastery' {
  export interface Schema<T = any> {
    [key: string]: any
    default(val: T): Schema<T>
  }
  export type SchemaType<T> = Schema<T>
  export interface Z {
    object(shape: Record<string, any>): Schema
    string(): Schema<string>
    number(): Schema<number>
    boolean(): Schema<boolean>
    [key: string]: any
  }
  const z: Z
  export default z
}

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(tool: any): any
}
