import {
  ButtonItem,
  ButtonItemProps,
  DropdownItem,
  Field,
  Navigation,
  PanelSection,
  PanelSectionProps,
  PanelSectionRow,
  showModal,
  ToggleField
} from '@decky/ui',
import { clearCache } from "./cache/muon_docs_cache",
import React, { FC, ReactNode } from 'react',

const GITHUB_URL = 'https://wtlnetwork.github.io/muon-docs'

// Top is a base, work from here