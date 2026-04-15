import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';

export const useNavigate = () => {
    const history = useHistory();


    const handleBack = () => {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const programId = params.get('programId');
        const selectedTemplateId = `${programId}-default`;

        navigate(`/?programId=${programId}&selectedTemplateId=${selectedTemplateId}&all`);
    };

    const navigate = useCallback((path: string, scrollToTop = true) => {
        if (path === '-1') {
            handleBack();
        } else{
            history.push(path);
        }

        if (scrollToTop) {
            window.scrollTo(0, 0);
        }
    }, [history]);

    return { navigate };
};
