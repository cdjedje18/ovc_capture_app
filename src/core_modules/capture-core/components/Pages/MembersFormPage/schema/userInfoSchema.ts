import { atom } from 'recoil';

// Reusable small pieces
interface IdObject {
  id: string;
}

interface Access {
  manage: boolean;
  externalize: boolean;
  write: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

interface Sharing {
  external: boolean;
  users: Record<string, unknown>;
  userGroups: Record<string, unknown>;
}

// Main interface
export interface UserInfo {
  id: string;
  username: string;
  surname: string;
  firstName: string;
  created: string;
  lastUpdated: string;

  dataViewOrganisationUnits: IdObject[];
  favorites: unknown[];
  sharing: Sharing;
  userGroupAccesses: unknown[];
  userAccesses: unknown[];
  userGroups: IdObject[];
  translations: unknown[];
  teiSearchOrganisationUnits: IdObject[];
  organisationUnits: IdObject[];
  externalAccess: boolean;
  displayName: string;
  access: Access;
  name: string;

  userRoles: IdObject[];

  settings: {
    keyMessageSmsNotification: boolean;
    keyTrackerDashboardLayout: string; // it's a JSON string
    keyStyle: string;
    keyUiLocale: string;
    keyAnalysisDisplayProperty: string;
    keyMessageEmailNotification: boolean;
  };

  programs: string[];
  authorities: string[];
  dataSets: string[];

  userCredentials: {
    id: string;
    username: string;
    externalAuth: boolean;
    twoFA: boolean;
    passwordLastUpdated: string;
    cogsDimensionConstraints: unknown[];
    catDimensionConstraints: unknown[];
    previousPasswords: unknown[];
    lastLogin: string;
    selfRegistered: boolean;
    invitation: boolean;
    disabled: boolean;
    access: Access;
    sharing: Sharing;
    userRoles: IdObject[];
  };
}

export const UserInfoState = atom<UserInfo>({
    key: 'userInfo-store',
    default: {} as unknown as UserInfo,
});
