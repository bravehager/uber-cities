KAFKA_PATH = kafka

zookeeper-init:
	${KAFKA_PATH}/bin/zookeeper-server-start.sh ${KAFKA_PATH}/config/zookeeper.properties

kafka-init:
	${KAFKA_PATH}/bin/kafka-server-start.sh ${KAFKA_PATH}/config/server.properties

kafka-ls:
	${KAFKA_PATH}/bin/kafka-topics.sh --list --bootstrap-server localhost:9092