import { type InjectionKey } from 'vue'

/** 子应用可注入的菜单 API */
export interface SubAppMenuAction {
  name: string
  key: string
}

export interface SubAppMenuApi {
  setActions: (actions: SubAppMenuAction[]) => void
  clearActions: () => void
  onSelect: (cb: (key: string) => void) => void
}

export const SUBAPP_MENU_KEY: InjectionKey<SubAppMenuApi> = Symbol('subapp-menu')
