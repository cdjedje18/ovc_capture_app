import { useDataQuery } from "@dhis2/app-runtime"
import { useCreateDsDir } from "./useCreateDsDir";
import useShowAlerts from 'capture-core/components/Pages/MembersFormPage/hooks/common/useShowAlert';

const DATASTORE_QUERY = ({
    config: {
        resource: "dataStore/ovc_capture_app",
        params: {
            fields: "."
        }
    }
})

export function useDataStore() {
    const { hide, show } = useShowAlerts()
    const { createDir, loading: loadingCreation } = useCreateDsDir()

    const { data, loading, error } = useDataQuery<{ config: any }>(DATASTORE_QUERY, {
        onError(error) {
            console.log(error)
            show({
                message: `Ocorreu um erro inesperado`,
                type: { critical: true }
            });
            setTimeout(hide, 5000);
        },
        onComplete(data) {
            checkDataStore(data?.config)
        }
    })

    const checkDataStore = (data: any) => {
        const hasTemplatesKey = data?.entries?.some((entry: any) => (entry.key === "data_entry" || entry.key === "programs"));

        if (!data?.entries?.length && hasTemplatesKey) {
            const keys = ['data_entry', 'programs']?.filter((key: string) => !data?.entries?.some((entry: any) => entry.key === key))

            for (const key of keys) {
                createDir(key)
            }
        }
    }

    return {
        data,
        loading: loading || loadingCreation,
        error,
        checkDataStore
    }
}
