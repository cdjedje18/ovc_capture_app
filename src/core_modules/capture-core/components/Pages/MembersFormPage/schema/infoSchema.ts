import { atom } from 'recoil';

export const sysInfoState = atom<string>({
    key: 'info-state',
    default: '',
});

export const displayTextRule = atom<any[]>({
    key: 'display-text',
    default: [],
});
