export const isMembersFormPage = () =>
    typeof window !== 'undefined'
    && (window.location.pathname.includes('/membersForm') || window.location.hash.includes('/membersForm'));
