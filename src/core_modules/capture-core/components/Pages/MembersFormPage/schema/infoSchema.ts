import { atom } from 'recoil';

export const sysInfoState = atom<string>({
    key: 'info-state',
    default: '',
});
