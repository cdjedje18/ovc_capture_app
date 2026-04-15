import { useDataEngine } from "@dhis2/app-runtime"
import useShowAlerts from "capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert";

const DATASTORE_QUERY = () => ({
    config: {
        resource: `dataStore/ovc_capture_app`,
        params: {
            fields: "."
        }
    }
})

export function useGetFavorites() {
    const engine = useDataEngine()
    const { hide, show } = useShowAlerts()

    async function getTemplates() {

        await engine.query(DATASTORE_QUERY(), {
            onComplete: (data) => {
                // console.log(data,'bla matusse')
            },
            onError: (error) => {
                show({
                    message: `Ocorreu um erro inesperado`,
                    type: { critical: true }
                });
                setTimeout(hide, 5000);
            }
        })
    }

    return {
        getTemplates
    }
}
